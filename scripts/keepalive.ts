import { getDb } from "../lib/db";
import { loadLocalEnv } from "../lib/env";
import { runs } from "../lib/db/schema";

/**
 * GitHub disables scheduled workflows after 60 days of repository inactivity,
 * and it does so silently — the cron simply stops and nothing reports it. A
 * write here proves the workflow ran, which is what the Phase 3 exit test looks
 * at, and gives a cheap heartbeat to check when leads stop appearing.
 *
 * Neon autosuspends after 5 minutes idle, so this also costs nothing on a quiet
 * day beyond the wake it was going to pay for anyway.
 */
async function main() {
  loadLocalEnv();
  const db = getDb();
  const now = new Date();
  await db.insert(runs).values({ kind: "keepalive", startedAt: now, finishedAt: now });
  console.log(`keepalive: ${now.toISOString()}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
