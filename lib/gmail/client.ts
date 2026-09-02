/**
 * Gmail, over plain fetch. No SDK: `googleapis` is tens of megabytes to reach
 * two endpoints, and a smaller dependency surface is a smaller thing to audit
 * for a client that holds a refresh token.
 *
 * Scope is `gmail.compose` and nothing wider. That scope can create drafts and
 * cannot read the mailbox, which is the least this needs and the most it should
 * ever have.
 *
 * There is no send function in this file. That is a product decision, not an
 * omission — see CLAUDE.md rule 2. Do not add one.
 */
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.compose";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRAFTS_URL = "https://gmail.googleapis.com/gmail/v1/users/me/drafts";

export interface GmailCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export function readCredentials(): GmailCredentials {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  const missing = [
    !clientId && "GOOGLE_CLIENT_ID",
    !clientSecret && "GOOGLE_CLIENT_SECRET",
    !refreshToken && "GOOGLE_REFRESH_TOKEN",
  ].filter(Boolean);

  if (missing.length) {
    throw new Error(`missing Gmail credentials: ${missing.join(", ")} — run pnpm gmail:auth`);
  }
  return { clientId: clientId!, clientSecret: clientSecret!, refreshToken: refreshToken! };
}

export async function getAccessToken(creds: GmailCredentials): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    // The body of a failed token exchange echoes no secret, only an error code.
    const body = await res.text();
    throw new Error(explainTokenFailure(res.status, body));
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("token refresh returned no access_token");
  return data.access_token;
}

/** RFC 2822, base64url. Non-ASCII subjects are encoded rather than mangled. */
export function buildMime({
  to,
  subject,
  body,
}: {
  to: string;
  subject: string;
  body: string;
}): string {
  const encodedSubject = /^[\x20-\x7E]*$/.test(subject)
    ? subject
    : `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;

  const mime = [
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    body,
  ].join("\r\n");

  return Buffer.from(mime, "utf8").toString("base64url");
}

/** Creates a draft. Returns its Gmail id. Never sends. */
export async function createDraft(
  accessToken: string,
  message: { to: string; subject: string; body: string },
): Promise<string> {
  const res = await fetch(DRAFTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: { raw: buildMime(message) } }),
  });

  if (!res.ok) {
    throw new Error(`draft creation failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error("draft creation returned no id");
  return data.id;
}

/**
 * Turns a token failure into the sentence a person needs at 4am.
 *
 * `invalid_grant` is the one that will happen: while the OAuth consent screen is
 * in Testing, Google expires refresh tokens after seven days, so the Gmail path
 * dies about a week after each authorisation with a message that explains
 * nothing. The fix is always the same, and it belongs in the error rather than
 * in a document nobody is reading at the time.
 */
export function explainTokenFailure(status: number, body: string): string {
  if (/invalid_grant/.test(body)) {
    return (
      "Gmail refresh token rejected (invalid_grant). While the OAuth consent " +
      "screen is in Testing, Google expires refresh tokens after seven days. " +
      "Run `pnpm gmail:auth`, then put the new GOOGLE_REFRESH_TOKEN in .env.local " +
      "and in the GitHub secret. Publishing the app stops it expiring."
    );
  }
  if (/invalid_client/.test(body)) {
    return (
      "Gmail rejected the client credentials (invalid_client). GOOGLE_CLIENT_ID " +
      "or GOOGLE_CLIENT_SECRET is wrong or belongs to a different project."
    );
  }
  return `token refresh failed: ${status} ${body}`;
}
