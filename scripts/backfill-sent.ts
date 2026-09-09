import { and, eq, isNotNull, sql } from "drizzle-orm";
import { getDb } from "../lib/db";
import { loadLocalEnv } from "../lib/env";
import { leads, outreach } from "../lib/db/schema";

/**
 * Moves leads whose email actually went out from `in_gmail` to `sent`.
 *
 * One-off. `in_gmail` used to be the end of the line because there was no
 * further status, so leads that were sent kept it and the funnel read
 * "in_gmail=2" for two delivered applications.
 */
async function main() {
  loadLocalEnv();
  const db = getDb();

  const moved = await db
    .update(leads)
    .set({ status: "sent" })
    .where(
      and(
        eq(leads.status, "in_gmail"),
        sql`exists (select 1 from ${outreach} where ${outreach.leadId} = ${leads.id} and ${outreach.sentAt} is not null)`,
      ),
    )
    .returning({ company: leads.company });

  console.log(
    moved.length
      ? `backfill: ${moved.length} lead(s) moved to sent — ${moved.map((m) => m.company).join(", ")}`
      : "backfill: nothing to move",
  );

  // A draft still waiting in the mailbox keeps in_gmail, which is now accurate.
  const waiting = await db
    .select({ company: leads.company })
    .from(leads)
    .where(eq(leads.status, "in_gmail"));
  console.log(`still in_gmail (draft waiting): ${waiting.length}`);
}

main().catch((err) => {
  console.error("backfill:", err instanceof Error ? err.message : err);
  process.exit(1);
});
