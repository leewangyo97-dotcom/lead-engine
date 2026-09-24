import { eq, inArray } from "drizzle-orm";
import { getDb } from "../lib/db";
import { loadLocalEnv } from "../lib/env";
import { events, leads, scores } from "../lib/db/schema";
import { ScoreBatch, readValidatedStdin } from "../lib/model/schemas";
import { NEEDS_DRAFT_THRESHOLD, RUBRIC_VERSION, fromLead, prescore } from "../lib/scoring/prescore";
import { addRunCounts } from "../lib/leads/run-metrics";

/**
 * Takes validated model scores on stdin and promotes or parks each lead.
 *
 * The promotion rule lives here rather than in the prompt: a threshold the model
 * is asked to apply is a threshold that drifts. The model supplies judgment —
 * a number and a reason — and code decides what happens as a result.
 */
async function main() {
  loadLocalEnv();
  const db = getDb();
  const { scores: items } = await readValidatedStdin(ScoreBatch);

  // Only leads actually awaiting scoring may be written. Without this, a stale
  // or hallucinated id would silently overwrite a lead already drafted or sent.
  const pending = await db.select().from(leads).where(eq(leads.status, "needs_scoring"));
  const allowed = new Set(pending.map((r) => r.id));
  const byId = new Map(pending.map((r) => [r.id, r]));

  const unknown = items.filter((i) => !allowed.has(i.id));
  if (unknown.length) {
    console.error(
      `${unknown.length} of ${items.length} ids are not awaiting scoring: ${unknown.map((u) => u.id).join(", ")}`,
    );
    process.exit(1);
  }

  for (const item of items) {
    await db
      .update(scores)
      .set({
        modelScore: item.score,
        tier: item.tier,
        reason: item.reason,
        // Recomputed here, not left from the prefilter. This row is stamped
        // with today's rubric and today's date, and a `preScore` from days ago
        // under an older rubric would be relabelled as though it were computed
        // now — the lead page then explains a gap with a reason that is false.
        // Every field in the row now describes one moment and one rubric.
        preScore: prescore(fromLead(byId.get(item.id)!)).score,
        rubricVer: RUBRIC_VERSION,
        scoredAt: new Date(),
      })
      .where(eq(scores.leadId, item.id));
  }

  const promoted = items.filter((i) => i.score >= NEEDS_DRAFT_THRESHOLD).map((i) => i.id);
  const parked = items.filter((i) => i.score < NEEDS_DRAFT_THRESHOLD).map((i) => i.id);

  if (promoted.length) {
    await db.update(leads).set({ status: "needs_draft" }).where(inArray(leads.id, promoted));
  }
  if (parked.length) {
    await db.update(leads).set({ status: "parked" }).where(inArray(leads.id, parked));
  }

  await db.insert(events).values(
    items.map((i) => ({
      leadId: i.id,
      type: "status_change",
      meta: { status: i.score >= NEEDS_DRAFT_THRESHOLD ? "needs_draft" : "parked", score: i.score, by: "scorer" },
    })),
  );

  await addRunCounts({ scored: items.length });

  console.log(
    `apply-scores: scored=${items.length} promoted=${promoted.length} parked=${parked.length} (threshold ${NEEDS_DRAFT_THRESHOLD})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
