import { createServer } from "node:http";
import { GMAIL_SCOPE } from "../lib/gmail/client";
import { loadLocalEnv } from "../lib/env";

/**
 * One-time OAuth to obtain a refresh token. Run it, approve in the browser, then
 * put the printed value in .env.local.
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

  console.log("Open this URL and approve:\n");
  console.log(authUrl);
  console.log(`\nWaiting on ${REDIRECT} ...`);

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
    server.listen(PORT);
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

  console.log("\nAdd this line to .env.local (it is gitignored):\n");
  console.log(`GOOGLE_REFRESH_TOKEN="${data.refresh_token}"`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
