import { desc } from "drizzle-orm";
import { getDb } from "../db";
import { runMetrics, sources } from "../db/schema";
import { pipelineFaults } from "../health";

/**
 * The same fault check the nightly run uses, reused by the app.
 *
 * Without this the only place a stalled pipeline shows up is a workflow log.
 * The inbox looking normal while nothing has been harvested for a week is the
 * failure this is here to make visible.
 */
export async function getPipelineFaults(): Promise<string[]> {
  const db = getDb();
  const [latest] = await db.select().from(runMetrics).orderBy(desc(runMetrics.runAt)).limit(1);
  const rows = await db.select().from(sources);

  return pipelineFaults({
    latestRawCount: latest?.rawCount ?? null,
    sources: rows.map((r) => ({
      id: r.id,
      lastRunAt: r.lastRunAt,
      lastOk: r.lastOk,
      lastError: r.lastError,
    })),
  });
}
