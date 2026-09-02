import { eq } from "drizzle-orm";
import { getDb } from "../lib/db";
import { loadLocalEnv } from "../lib/env";
import { prospects } from "../lib/db/schema";
import { scoreProspect } from "../lib/places/score";

/**
 * Scores prospects.
 *
 *   pnpm prospects:score [searchId]
 *
 * Cheap and pure — no network, no model. Re-running after a weight change is
 * the intended way to work, which is why nothing here is incremental.
 */
async function main() {
  loadLocalEnv();
  const db = getDb();
  const searchId = process.argv.slice(2).find((a) => !a.startsWith("-"));

  const rows = await db
    .select()
    .from(prospects)
    .where(searchId ? eq(prospects.searchId, searchId) : undefined);

  if (rows.length === 0) {
    console.log("prospects:score: nothing to score");
    return;
  }

  const tiers = { hot: 0, warm: 0, cold: 0 };
  for (const row of rows) {
    const { score, reasons, tier } = scoreProspect(row);
    tiers[tier]++;
    await db
      .update(prospects)
      .set({ score, scoreReasons: reasons, updatedAt: new Date() })
      .where(eq(prospects.id, row.id));
  }

  console.log(
    `prospects:score: ${rows.length} scored — ${tiers.hot} hot, ${tiers.warm} warm, ${tiers.cold} cold`,
  );
}

main().catch((err) => {
  console.error("prospects:score:", err instanceof Error ? err.message : err);
  process.exit(1);
});
