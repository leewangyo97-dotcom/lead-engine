import { desc, eq } from "drizzle-orm";
import { getDb } from "../lib/db";
import { loadLocalEnv } from "../lib/env";
import { runMetrics } from "../lib/db/schema";

/**
 * Records what a /daily-run cost, against the most recent run.
 *
 * `run_metrics` has carried tokensIn and tokensOut since Phase 1 and nothing has
 * ever written them, so `pnpm tokens` reports "(not measured)" every time and
 * Phase 5's exit test — under 25,000 tokens for a run — cannot be checked at
 * all. A budget nobody can measure is a budget nobody keeps.
 *
 * Model calls happen inside Claude Code rather than server-side, so the counts
 * come from the session that made them:
 *
 *   pnpm tokens:record --in 6000 --out 1200 --scored 18 --drafted 7
 *
 * Only the funnel counts that a model produced are set here. Harvest already
 * records the deterministic ones.
 */
function arg(name: string): number | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const value = Number(process.argv[i + 1]);
  return Number.isFinite(value) ? value : undefined;
}

async function main() {
  loadLocalEnv();
  const tokensIn = arg("in");
  const tokensOut = arg("out");

  if (tokensIn === undefined || tokensOut === undefined) {
    console.error("usage: pnpm tokens:record --in <n> --out <n> [--scored <n>] [--drafted <n>]");
    process.exit(1);
  }

  const db = getDb();
  const [latest] = await db.select().from(runMetrics).orderBy(desc(runMetrics.runAt)).limit(1);

  if (!latest) {
    console.error("no run recorded yet — run a harvest first");
    process.exit(1);
  }

  const scored = arg("scored");
  const drafted = arg("drafted");

  await db
    .update(runMetrics)
    .set({
      tokensIn,
      tokensOut,
      ...(scored !== undefined ? { scoredCount: scored } : {}),
      ...(drafted !== undefined ? { draftedCount: drafted } : {}),
    })
    .where(eq(runMetrics.id, latest.id));

  const total = tokensIn + tokensOut;
  console.log(
    `tokens:record: ${total} tokens against the run at ${latest.runAt.toISOString()}` +
      (total > 25_000 ? " — over the 25,000 target" : ""),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
