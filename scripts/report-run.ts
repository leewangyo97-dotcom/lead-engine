import { appendFileSync } from "node:fs";
import { count, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../lib/db";
import { loadLocalEnv } from "../lib/env";
import { leads, runMetrics, sources } from "../lib/db/schema";
import { pipelineFaults } from "../lib/health";

/**
 * The funnel, printed into the Actions log. This is the only place a quiet
 * failure becomes visible: an adapter that returns zero rows still exits 0, so
 * without this the workflow stays green while the pipeline starves.
 */
async function main() {
  loadLocalEnv();
  const db = getDb();

  const [latest] = await db.select().from(runMetrics).orderBy(desc(runMetrics.runAt)).limit(1);

  const byStatus = await db
    .select({ status: leads.status, n: count() })
    .from(leads)
    .groupBy(leads.status);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [{ n: freshCount } = { n: 0 }] = await db
    .select({ n: count() })
    .from(leads)
    .where(gte(leads.harvestedAt, since));

  const sourceRows = await db.select().from(sources);

  if (latest) {
    console.log(
      `funnel: raw=${latest.rawCount} unique=${latest.afterHash} inserted=${latest.afterFilter} in ${latest.durationMs}ms`,
    );
  } else {
    console.log("funnel: no run recorded yet");
  }

  const statusLine = byStatus
    .sort((a, b) => b.n - a.n)
    .map((r) => `${r.status}=${r.n}`)
    .join(" ");
  console.log(`leads: ${statusLine || "none"}`);
  console.log(`harvested in last 24h: ${freshCount}`);

  for (const s of sourceRows) {
    const state = s.lastOk ? "ok" : `FAILED: ${s.lastError ?? "unknown"}`;
    console.log(
      `source ${s.id}: ${state} · ${s.lastRawCount ?? "?"} raw (last run ${s.lastRunAt?.toISOString() ?? "never"})`,
    );
  }

  const faults = pipelineFaults({
    latestRawCount: latest?.rawCount ?? null,
    sources: sourceRows.map((r) => ({
      id: r.id,
      lastRunAt: r.lastRunAt,
      lastOk: r.lastOk,
      lastError: r.lastError,
      lastRawCount: r.lastRawCount,
    })),
  });

  // Exit non-zero so the run goes red. A fault printed into a log that nobody
  // opens is a fault nobody knows about.
  if (faults.length) {
    for (const fault of faults) console.error(fault);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
