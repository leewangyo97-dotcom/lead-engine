import { and, asc, eq, gt, sql } from "drizzle-orm";
import { getDb } from "../lib/db";
import { loadLocalEnv } from "../lib/env";
import { chunk } from "../lib/chunk";
import { prospects } from "../lib/db/schema";
import { scoreProspect } from "../lib/places/score";
import { allBounced, isBouncedIn } from "../lib/places/bounce";

/**
 * Rows read per query, and written per statement. Each is a round trip to the
 * database, and round trips are the whole cost: at 2,000 and 500, 163,195 rows
 * took ten minutes, against the nightly's fifteen. Only the columns the score
 * reads are fetched, which keeps a page well inside one HTTP answer.
 */
const PAGE = 5_000;
const WRITE = 2_500;

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

  // A bounced address counts for nothing (bounce.ts). One query for all of them.
  const bounced = await allBounced();
  const tiers = { hot: 0, warm: 0, cold: 0 };
  let written = 0;
  let after = "";

  /*
   * A page of rows at a time, in id order.
   *
   * This read every prospect in one query, and with Canada's 109,006 new rows
   * (17 Oct) the table passed 160,000: more than the Neon HTTP driver returns
   * in one answer, so scoring failed outright, the nightly's step with it.
   */
  for (;;) {
    const rows = await db
      .select({
        id: prospects.id,
        name: prospects.name,
        category: prospects.category,
        city: prospects.city,
        website: prospects.website,
        email: prospects.email,
        emailConfidence: prospects.emailConfidence,
        emailCheck: prospects.emailCheck,
        phoneE164: prospects.phoneE164,
        whatsappE164: prospects.whatsappE164,
        enrichmentStatus: prospects.enrichmentStatus,
        siteSignals: prospects.siteSignals,
        status: prospects.status,
      })
      .from(prospects)
      .where(and(searchId ? eq(prospects.searchId, searchId) : undefined, gt(prospects.id, after)))
      .orderBy(asc(prospects.id))
      .limit(PAGE);
    if (rows.length === 0) break;
    after = rows[rows.length - 1].id;

    const scored = rows.map((row) => {
      const { score, reasons, tier } = scoreProspect({ ...row, emailBounced: isBouncedIn(bounced, row.email) });
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
    for (const batch of chunk(scored, WRITE)) {
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
  }

  if (written === 0) {
    console.log("prospects:score: nothing to score");
    return;
  }

  console.log(
    `prospects:score: ${written} scored — ${tiers.hot} hot, ${tiers.warm} warm, ${tiers.cold} cold`,
  );
}

main().catch((err) => {
  console.error("prospects:score:", err instanceof Error ? err.message : err);
  process.exit(1);
});
