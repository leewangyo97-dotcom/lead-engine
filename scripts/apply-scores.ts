import { eq, inArray } from "drizzle-orm";
import { getDb } from "../lib/db";
import { loadLocalEnv } from "../lib/env";
import { events, leads, scores } from "../lib/db/schema";
import { ScoreBatch, readValidatedStdin } from "../lib/model/schemas";
import { NEEDS_DRAFT_THRESHOLD, RUBRIC_VERSION } from "../lib/scoring/prescore";

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
  const pending = await db
    .select({ id: leads.id })
    .from(leads)
    .where(eq(leads.status, "needs_scoring"));
  const allowed = new Set(pending.map((r) => r.id));

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

  console.log(
    `apply-scores: scored=${items.length} promoted=${promoted.length} parked=${parked.length} (threshold ${NEEDS_DRAFT_THRESHOLD})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
