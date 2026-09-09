import { sql } from "drizzle-orm";
import { getDb } from "../db";

/**
 * How the scores are spread, from Figma's Score Distribution card (3:1694).
 *
 * The review page could say what replied and what did not, but nothing about
 * whether the rubric is producing a usable spread in the first place. Those are
 * different failures: a scorer that puts everything in one band is broken even
 * when the reply rates look fine, and it is invisible in a table of outcomes
 * because the leads that never cleared the threshold were never sent anything.
 *
 * Bands are the design's: five of twenty, high first.
 */
export const BANDS = [
  { label: "81–100", min: 81, max: 100 },
  { label: "61–80", min: 61, max: 80 },
  { label: "41–60", min: 41, max: 60 },
  { label: "21–40", min: 21, max: 40 },
  { label: "0–20", min: 0, max: 20 },
] as const;

export interface Band {
  label: string;
  count: number;
  /** Width of the bar as a percentage of the largest band, 0–100. */
  width: number;
}

/**
 * Bars are scaled to the largest band, not to the total.
 *
 * Scaled to the total, a realistic spread draws five short stubs and the shape
 * is unreadable. The number is printed beside each bar, so the bar carries the
 * comparison and the figure carries the magnitude.
 */
export function toBands(counts: number[]): Band[] {
  const largest = Math.max(0, ...counts);
  return BANDS.map((band, i) => {
    const count = counts[i] ?? 0;
    return {
      label: band.label,
      count,
      // No leads at all is a flat chart rather than a division by zero.
      width: largest === 0 ? 0 : Math.round((count / largest) * 100),
    };
  });
}

/**
 * One query. `scores` is append-only, so a lead re-judged under a new rubric has
 * several rows and only the newest counts — the same rule the inbox uses, and
 * getting it wrong would count a lead once per time it was scored.
 */
export async function getScoreDistribution(): Promise<Band[]> {
  const db = getDb();

  const result = await db.execute(sql`
    with latest as (
      select distinct on (s.lead_id)
        s.lead_id,
        coalesce(s.model_score, s.pre_score) as score
      from scores s
      order by s.lead_id, s.scored_at desc
    )
    select
      count(*) filter (where score >= 81)::int as b5,
      count(*) filter (where score between 61 and 80)::int as b4,
      count(*) filter (where score between 41 and 60)::int as b3,
      count(*) filter (where score between 21 and 40)::int as b2,
      count(*) filter (where score <= 20)::int as b1
    from latest
  `);

  const r = result.rows[0] as Record<string, number> | undefined;
  return toBands([r?.b5 ?? 0, r?.b4 ?? 0, r?.b3 ?? 0, r?.b2 ?? 0, r?.b1 ?? 0]);
}
