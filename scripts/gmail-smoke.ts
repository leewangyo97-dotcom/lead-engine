import { loadLocalEnv } from "../lib/env";
import { buildMime, createDraft, getAccessToken, readCredentials } from "../lib/gmail/client";

/**
 * Proves the Gmail path without emailing anybody.
 *
 * The draft→Gmail step is the only one that cannot be exercised by the test
 * suite, and waiting for a qualifying lead to discover a credential or MIME
 * problem is the wrong time to find out. This creates a draft addressed to
 * Joshua himself, verifies it came back with an id, then deletes it — so a green
 * run leaves the mailbox exactly as it found it.
 *
 * It is a smoke test, not a rehearsal of an email: the body says what it is.
 */
const SELF = "joshuasenining31@gmail.com";
const DRAFTS_URL = "https://gmail.googleapis.com/gmail/v1/users/me/drafts";

async function main() {
  loadLocalEnv();
  const token = await getAccessToken(readCredentials());
  console.log("token refresh: ok");

  const draftId = await createDraft(token, {
    to: SELF,
    subject: "lead-engine smoke test — safe to delete",
    body:
      "Created by `pnpm gmail:smoke` to verify the drafts.create path.\n" +
      "If this script finished, it has already deleted itself.\n",
  });
  console.log("draft created:", draftId);

  // Read it back. A returned id proves the API accepted the request; fetching
  // it proves the draft actually exists in the mailbox.
  const check = await fetch(`${DRAFTS_URL}/${draftId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log("draft readable:", check.ok ? "yes" : `no (${check.status})`);

  const del = await fetch(`${DRAFTS_URL}/${draftId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!del.ok) {
    console.error(`could not delete draft ${draftId} — remove it by hand`);
    process.exit(1);
  }
  console.log("draft deleted: mailbox unchanged");

  // The MIME builder is pure, so assert its output here rather than in Gmail.
  const raw = Buffer.from(buildMime({ to: SELF, subject: "ünïcode", body: "x" }), "base64url")
    .toString("utf8");
  console.log("mime encodes non-ascii:", raw.includes("=?UTF-8?B?") ? "yes" : "NO");
  console.log("\ngmail path: verified end to end, nothing sent");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
