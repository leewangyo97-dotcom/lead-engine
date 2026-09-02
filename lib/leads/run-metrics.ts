import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { runMetrics } from "../db/schema";

/**
 * Adds model-produced counts to the most recent run.
 *
 * Harvest writes the deterministic half of `run_metrics` and nothing wrote the
 * rest, so every run read `scored=0 drafted=0` however much work had been done —
 * the funnel report described a pipeline that stopped at the filter. The scripts
 * that apply model output know these numbers, so they record them rather than
 * waiting for someone to remember.
 *
 * Accumulates: a retry writes a second draft for the same lead, and both cost
 * something. Silent when there is no run to attach to — a count with nowhere to
 * go is not worth failing a script over.
 */
export async function addRunCounts(counts: {
  scored?: number;
  drafted?: number;
}): Promise<boolean> {
  const db = getDb();

  const [latest] = await db
    .select({ id: runMetrics.id })
    .from(runMetrics)
    .orderBy(desc(runMetrics.runAt))
    .limit(1);
  if (!latest) return false;

  await db
    .update(runMetrics)
    .set({
      scoredCount: sql`${runMetrics.scoredCount} + ${counts.scored ?? 0}`,
      draftedCount: sql`${runMetrics.draftedCount} + ${counts.drafted ?? 0}`,
    })
    .where(eq(runMetrics.id, latest.id));

  return true;
}
