import { eq, sql } from "drizzle-orm";
import { getDb } from "../lib/db";
import { loadLocalEnv } from "../lib/env";
import { chunk } from "../lib/chunk";
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
  const scored = rows.map((row) => {
    const { score, reasons, tier } = scoreProspect(row);
    tiers[tier]++;
    return { id: row.id, score, reasons };
  });

  /*
   * One statement per batch, not one per row.
   *
   * This wrote a single UPDATE per prospect, which is fine for the 446 rows a
   * few city searches produce and absurd for the 23,000 a country produces: the
   * Neon HTTP driver is one request per statement, so that is 23,000 round
   * trips, several minutes of wall clock and a bite out of a 100 CU-hour month
   * to compute something with no network in it at all.
   *
   * A VALUES join does the same work in one statement per 500 rows. The casts
   * are explicit because a parameter inside VALUES has no type for Postgres to
   * infer from, and an untyped `score` arrives as text.
   */
  let written = 0;
  for (const batch of chunk(scored)) {
    const values = sql.join(
      batch.map((r) => sql`(${r.id}::text, ${r.score}::int, ${JSON.stringify(r.reasons)}::jsonb)`),
      sql`, `,
    );
    await db.execute(sql`
      update prospects set
        score = v.score,
        score_reasons = v.reasons,
        updated_at = now()
      from (values ${values}) as v(id, score, reasons)
      where prospects.id = v.id
    `);
    written += batch.length;
  }

  console.log(
    `prospects:score: ${written} scored — ${tiers.hot} hot, ${tiers.warm} warm, ${tiers.cold} cold`,
  );
}

main().catch((err) => {
  console.error("prospects:score:", err instanceof Error ? err.message : err);
  process.exit(1);
});
