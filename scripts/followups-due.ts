import { loadLocalEnv } from "../lib/env";
import { getDueFollowups } from "../lib/leads/followup-queries";

/**
 * Emits the follow-up payload for `/daily-run`, in the same shape and with the
 * same projection discipline as the first-touch one.
 *
 * The previous subject and angle are included so the follow-up can reference the
 * earlier email rather than repeat it. The body is not: a follow-up that quotes
 * itself back is the thing everyone does badly, and sending the whole prior email
 * into the prompt costs tokens to make that outcome likelier.
 */
async function main() {
  loadLocalEnv();
  const due = await getDueFollowups();
  process.stdout.write(JSON.stringify({ count: due.length, followups: due }, null, 1));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
