import { desc, eq } from "drizzle-orm";
import { getDb } from "../lib/db";
import { loadLocalEnv } from "../lib/env";
import { leads, scores } from "../lib/db/schema";

/**
 * Emits the scoring payload as compact JSON — the only thing the model sees.
 *
 * Projected, not selected whole. Scoring needs company, title, region, contract
 * and stack; it does not need the URL, the external id, the harvest timestamp or
 * the content hash. Each row here is roughly 120 tokens against 2,000-5,000 for
 * the raw posting it came from, which is the single biggest saving in the system.
 */
const STOP_ABOVE = 40;

async function main() {
  loadLocalEnv();
  const db = getDb();

  const rows = await db
    .select({
      id: leads.id,
      company: leads.company,
      title: leads.title,
      region: leads.region,
      remoteScope: leads.remoteScope,
      overlapHours: leads.overlapHours,
      isContract: leads.isContract,
      isDirect: leads.isDirect,
      payRaw: leads.payRaw,
      payMinUsdHr: leads.payMinUsdHr,
      stack: leads.stack,
      summary: leads.summary,
      triggerEvent: leads.triggerEvent,
      preScore: scores.preScore,
    })
    .from(leads)
    .leftJoin(scores, eq(scores.leadId, leads.id))
    .where(eq(leads.status, "needs_scoring"))
    .orderBy(desc(scores.preScore));

  // The pre-filter is the entire cost control. If it stops filtering, the bill
  // is what regresses, and it does so silently — so this refuses to proceed
  // rather than spending the tokens and reporting it afterwards.
  if (rows.length > STOP_ABOVE) {
    console.error(
      `${rows.length} rows are marked needs_scoring, over the ${STOP_ABOVE} ceiling. The pre-filter has regressed — fix it before spending tokens.`,
    );
    process.exit(1);
  }

  process.stdout.write(JSON.stringify({ count: rows.length, leads: rows }, null, 1));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
