import { desc, eq } from "drizzle-orm";
import { getDb } from "../lib/db";
import { loadLocalEnv } from "../lib/env";
import { leads, scores } from "../lib/db/schema";

/**
 * Emits the drafting payload. Same projection discipline as scoring, plus the
 * fields the proof-match table keys on: stack, trigger, region and overlap.
 *
 * The summary is included here because the opening line has to be specific about
 * them, and it is the only place that specificity can come from. It is already
 * capped at 400 characters at ingest, so including it is bounded by construction
 * rather than by anyone remembering to truncate.
 */
async function main() {
  loadLocalEnv();
  const db = getDb();

  const rows = await db
    .select({
      id: leads.id,
      company: leads.company,
      title: leads.title,
      region: leads.region,
      overlapHours: leads.overlapHours,
      isContract: leads.isContract,
      contact: leads.contact,
      isDirect: leads.isDirect,
      payRaw: leads.payRaw,
      stack: leads.stack,
      summary: leads.summary,
      triggerEvent: leads.triggerEvent,
      url: leads.url,
      modelScore: scores.modelScore,
      reason: scores.reason,
    })
    .from(leads)
    .leftJoin(scores, eq(scores.leadId, leads.id))
    .where(eq(leads.status, "needs_draft"))
    .orderBy(desc(scores.modelScore));

  process.stdout.write(JSON.stringify({ count: rows.length, leads: rows }, null, 1));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
