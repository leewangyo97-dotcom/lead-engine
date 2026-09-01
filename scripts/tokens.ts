import { desc } from "drizzle-orm";
import { getDb } from "../lib/db";
import { loadLocalEnv } from "../lib/env";
import { runMetrics } from "../lib/db/schema";

/**
 * Rule 12: measure it. A night over the ceiling is a failing test, not a
 * curiosity — and it is almost always a filter that stopped filtering rather
 * than a prompt that grew.
 */
const TARGET = 25_000;
const CEILING = 40_000;

async function main() {
  loadLocalEnv();
  const db = getDb();

  const rows = await db.select().from(runMetrics).orderBy(desc(runMetrics.runAt)).limit(7);
  if (!rows.length) {
    console.log("tokens: no runs recorded");
    return;
  }

  for (const r of rows) {
    const total = (r.tokensIn ?? 0) + (r.tokensOut ?? 0);
    const stamp = r.runAt.toISOString().slice(0, 16).replace("T", " ");
    const measured = r.tokensIn == null && r.tokensOut == null ? " (not measured)" : "";
    console.log(
      `${stamp}  raw=${r.rawCount} unique=${r.afterHash} filtered=${r.afterFilter} ` +
        `scored=${r.scoredCount} drafted=${r.draftedCount} tokens=${total}${measured}`,
    );
  }

  const latest = rows[0];
  const total = (latest.tokensIn ?? 0) + (latest.tokensOut ?? 0);

  if (total > CEILING) {
    console.error(
      `\nlast run used ${total} tokens, over the ${CEILING} ceiling. ` +
        `Check the funnel counts above — a filter has almost certainly stopped filtering.`,
    );
    process.exit(1);
  }

  if (total > TARGET) {
    console.log(`\nlast run used ${total} tokens, over the ${TARGET} target but under the ceiling.`);
  } else if (total > 0) {
    console.log(`\nlast run used ${total} tokens, within the ${TARGET} target.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
