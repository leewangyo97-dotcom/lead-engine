import { appendFileSync } from "node:fs";
import { count, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../lib/db";
import { loadLocalEnv } from "../lib/env";
import { leads, runMetrics, sources } from "../lib/db/schema";

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
    console.log(`source ${s.id}: ${state} (last run ${s.lastRunAt?.toISOString() ?? "never"})`);
  }

  // A broken source must fail the step, not sit green in the log where nobody
  // reads it. Exit non-zero so the run goes red.
  // GitHub renders this above the log, so the night's result is visible without
  // opening a job. A funnel buried in step output is a funnel nobody reads.
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const waiting = byStatus.find((r) => r.status === "needs_scoring")?.n ?? 0;
    const lines = [
      `## Nightly harvest`,
      "",
      latest
        ? `Funnel: **${latest.rawCount}** raw, ${latest.afterHash} unique, **${latest.afterFilter}** new.`
        : "No run recorded.",
      "",
      waiting > 0
        ? `**${waiting} lead(s) waiting at \`needs_scoring\`** — run \`/daily-run\`.`
        : "Nothing reached `needs_scoring`. No action.",
      "",
      "| status | count |",
      "|---|---|",
      ...byStatus.sort((a, b) => b.n - a.n).map((r) => `| ${r.status} | ${r.n} |`),
      "",
      ...sourceRows.map((s) => `- ${s.id}: ${s.lastOk ? "ok" : `**failed** — ${s.lastError ?? "unknown"}`}`),
      "",
    ];
    appendFileSync(summaryPath, lines.join("\n"));
  }

  const broken = sourceRows.filter((s) => !s.lastOk);
  if (broken.length) {
    console.error(`${broken.length} source(s) failed on the last run`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
