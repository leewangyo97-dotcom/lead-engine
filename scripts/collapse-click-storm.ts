import { and, asc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../lib/db";
import { loadLocalEnv } from "../lib/env";
import { outreach, prospects } from "../lib/db/schema";
import { REOPEN_WINDOW_MS } from "../lib/places/outreach-log";

/**
 * Removes the rungs that repeated clicks invented, before the reopen rule.
 *
 * Every click on WhatsApp or Email used to insert a row and bump the step, so
 * three clicks on one clinic wrote steps 0, 1 and 2 within seven minutes. Those
 * are not three conversations: they exhaust a ladder that was never climbed and
 * count three sends where one message was opened, which is the denominator the
 * weekly review divides by.
 *
 * Conservative by construction. It only removes a row that is (a) a prospect
 * row, (b) above step 0, and (c) created inside the reopen window of the
 * earliest row for that prospect — exactly the rows the current rule would
 * never have written. Anything spaced further apart is left alone, because a
 * real follow-up looks like that.
 */
async function main() {
  loadLocalEnv();
  const db = getDb();
  const dryRun = !process.argv.includes("--apply");

  const rows = await db
    .select({
      id: outreach.id,
      prospectId: sql<string>`${outreach.prospectId}`,
      step: outreach.step,
      createdAt: outreach.createdAt,
      name: prospects.name,
    })
    .from(outreach)
    .innerJoin(prospects, eq(prospects.id, outreach.prospectId))
    .where(gte(outreach.step, 0))
    .orderBy(asc(outreach.createdAt));

  const earliest = new Map<string, Date>();
  for (const row of rows) {
    if (!earliest.has(row.prospectId)) earliest.set(row.prospectId, row.createdAt);
  }

  const doomed = rows.filter((row) => {
    if (row.step === 0) return false;
    const first = earliest.get(row.prospectId)!;
    return row.createdAt.getTime() - first.getTime() < REOPEN_WINDOW_MS;
  });

  if (!doomed.length) {
    console.log("collapse: nothing to remove");
    return;
  }

  for (const row of doomed) {
    const first = earliest.get(row.prospectId)!;
    const minutes = Math.round((row.createdAt.getTime() - first.getTime()) / 60_000);
    console.log(`  ${row.name} step ${row.step}, ${minutes} min after the first — ${dryRun ? "would remove" : "removed"}`);
  }

  if (dryRun) {
    console.log(`collapse: ${doomed.length} row(s) would be removed. Pass --apply to do it.`);
    return;
  }

  for (const row of doomed) {
    await db.delete(outreach).where(eq(outreach.id, row.id));
  }

  // A prospect whose only rows were clicks is back to where it started.
  const stillContacted = await db
    .select({ id: prospects.id })
    .from(prospects)
    .where(
      and(
        eq(prospects.status, "contacted"),
        sql`not exists (select 1 from ${outreach} o where o.prospect_id = ${prospects.id} and o.sent_at is not null)`,
      ),
    );
  for (const p of stillContacted) {
    await db.update(prospects).set({ status: "new" }).where(eq(prospects.id, p.id));
  }

  console.log(
    `collapse: ${doomed.length} row(s) removed` +
      (stillContacted.length ? `, ${stillContacted.length} prospect(s) returned to new` : ""),
  );
}

main().catch((err) => {
  console.error("collapse:", err instanceof Error ? err.message : err);
  process.exit(1);
});
