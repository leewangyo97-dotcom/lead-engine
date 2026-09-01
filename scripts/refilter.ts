import { inArray, sql } from "drizzle-orm";
import { getDb } from "../lib/db";
import { loadLocalEnv } from "../lib/env";
import { events, leads, outreach, scores } from "../lib/db/schema";

/**
 * Re-judges the existing corpus after a rule or rubric change.
 *
 * A disqualifier edit only affects future harvests, because the content hash
 * means today's leads are never re-fetched. Without this, tightening a rule
 * leaves every previously-judged lead sitting at whatever the old rule decided,
 * and the funnel counts describe a filter that no longer exists.
 *
 * This has been done several times with throwaway scripts, each guarded by hand.
 * That is exactly the operation that should not be improvised.
 *
 * What it will not touch:
 *
 * - anything that has been drafted, put in Gmail, answered, won or lost. Those
 *   carry outcome history the learning loop is built on, and re-judging them
 *   would say a lead was disqualified after an email had already gone out.
 * - anything, at all, if the outreach table is not empty and --force is absent.
 *
 * Run `pnpm prefilter` afterwards to apply the current rules.
 */
const PROTECTED = [
  "needs_draft",
  "drafted",
  "in_gmail",
  "answered",
  "won",
  "lost",
  "closed",
] as const;

const REJUDGEABLE = ["parked", "disqualified", "needs_scoring", "scored"] as const;

async function main() {
  loadLocalEnv();
  const db = getDb();
  const force = process.argv.includes("--force");

  const [{ n: outreachCount }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(outreach);

  if (outreachCount > 0 && !force) {
    console.error(
      `refusing: ${outreachCount} outreach row(s) exist.\n` +
        "Re-judging a corpus that has already produced drafts can mark a lead\n" +
        "disqualified after an email went out. Pass --force only if you have\n" +
        "read that sentence and still mean it.",
    );
    process.exit(1);
  }

  const [{ n: protectedCount }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(leads)
    .where(inArray(leads.status, [...PROTECTED]));

  const rejudged = await db
    .update(leads)
    .set({ status: "harvested" })
    .where(inArray(leads.status, [...REJUDGEABLE]))
    .returning({ id: leads.id });

  const ids = rejudged.map((r) => r.id);

  if (ids.length) {
    // Both are re-derived by the next prefilter run. Leaving them would double
    // the score rows and leave stale disqualify reasons on /rejected.
    await db.delete(scores).where(inArray(scores.leadId, ids));
    await db
      .delete(events)
      .where(sql`${events.type} = 'disqualified' and ${events.leadId} in ${ids}`);
  }

  console.log(
    `refilter: ${ids.length} lead(s) returned to harvested, ${protectedCount} protected.\n` +
      "Run `pnpm prefilter` to judge them under the current rules.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
