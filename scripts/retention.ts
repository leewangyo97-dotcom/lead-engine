import { and, inArray, lt } from "drizzle-orm";
import { getDb } from "../lib/db";
import { loadLocalEnv } from "../lib/env";
import { leads } from "../lib/db/schema";
import { PRUNE_STATUSES, RETAIN_DAYS } from "../lib/retention";

/**
 * Monthly prune. Keeps storage flat inside Neon's 0.5 GB and keeps the dashboard
 * about this month rather than last year.
 *
 * Only dead statuses are touched. Anything drafted, in Gmail, answered or won is
 * kept regardless of age — that is the outcome history the Phase 6 learning loop
 * is built on, and it is not reconstructible once deleted. scores, outreach and
 * events cascade from leads, so deleting a lead takes its trail with it; that is
 * exactly why the status list is narrow. The policy itself lives in
 * lib/retention.ts so that reading it does not run this script.
 */

async function main() {
  loadLocalEnv();
  const db = getDb();
  const cutoff = new Date(Date.now() - RETAIN_DAYS * 86_400_000);

  const deleted = await db
    .delete(leads)
    .where(and(inArray(leads.status, [...PRUNE_STATUSES]), lt(leads.harvestedAt, cutoff)))
    .returning({ id: leads.id });

  console.log(
    `retention: deleted ${deleted.length} leads with status in (${PRUNE_STATUSES.join(", ")}) older than ${RETAIN_DAYS} days`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
