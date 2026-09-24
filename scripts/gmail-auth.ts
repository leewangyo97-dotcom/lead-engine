import { createServer } from "node:http";
import { GMAIL_SCOPE } from "../lib/gmail/client";
import { loadLocalEnv } from "../lib/env";
import { setLocalEnv } from "../lib/env-write";

/**
 * One-time OAuth to obtain a refresh token. Run it, approve in the browser, and
 * it writes the token to .env.local itself — it is never printed.
 *
 * The loopback redirect is used rather than pasting a code by hand: the code is
 * single-use and short-lived, and a code pasted through a terminal tends to end
 * up in shell history.
 *
 * `access_type=offline` and `prompt=consent` are both required — without the
 * second, Google returns a refresh token only on the very first authorisation
 * ever granted, and every later run silently returns none.
 */
const PORT = 53682;
const REDIRECT = `http://localhost:${PORT}/callback`;

async function main() {
  loadLocalEnv();
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error(
      "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local first.\n" +
        "Create them at console.cloud.google.com > APIs & Services > Credentials,\n" +
        `as an OAuth client of type "Web application" with redirect URI ${REDIRECT}`,
    );
    process.exit(1);
  }

  const authUrl =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT,
      response_type: "code",
      scope: GMAIL_SCOPE,
      access_type: "offline",
      prompt: "consent",
    });

  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
      if (url.pathname !== "/callback") {
        res.writeHead(404).end();
        return;
      }
      const received = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(received ? "Authorised. You can close this tab." : `Failed: ${error}`);
      server.close();

      if (received) resolve(received);
      else reject(new Error(error ?? "no code returned"));
    });
    // The URL and "waiting" are printed only once the port is really open. On
    // 24 Sept Google redirected to a callback nothing was listening on — the
    // browser said "localhost refused to connect" while the terminal still read
    // "Waiting on …", because that line went out before the listener existed and
    // stayed on screen after the process was gone. A code sent to a dead port is
    // wasted: it is single-use and expires in minutes.
    server.on("error", (err: NodeJS.ErrnoException) =>
      reject(
        new Error(
          err.code === "EADDRINUSE"
            ? `port ${PORT} is already in use — close the other gmail:auth and run this again`
            : `could not listen on ${REDIRECT}: ${err.message}`,
        ),
      ),
    );
    server.listen(PORT, () => {
      console.log("Open this URL and approve:\n");
      console.log(authUrl);
      console.log(`\nListening on ${REDIRECT} — keep this running until the browser says "Authorised".`);
    });
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT,
    }),
  });

  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { refresh_token?: string };

  if (!data.refresh_token) {
    throw new Error(
      "no refresh_token returned — revoke the app at myaccount.google.com/permissions and run this again",
    );
  }

  // Written, not printed. Printing it and trusting a paste failed the first time
  // it mattered: the token was generated, the paste never happened, and the Gmail
  // path stayed broken for a week. It also kept a live credential in terminal
  // scrollback, where it is one screenshot away from being shared.
  const outcome = setLocalEnv("GOOGLE_REFRESH_TOKEN", data.refresh_token);

  console.log(`\nGOOGLE_REFRESH_TOKEN ${outcome} in .env.local (gitignored).`);
  console.log("Run `pnpm gmail:smoke` to confirm the path works end to end.\n");
  console.log(
    "It expires in seven days while the consent screen is in Testing.\n" +
      "Publishing the app in Google Cloud ends the weekly re-auth.",
  );
}

main().catch((err) => {
  console.error(err);
  // `exitCode`, not `exit()` — see gmail-smoke.ts: after a network call, exit()
  // on Windows can crash natively instead of returning 1.
  process.exitCode = 1;
});
