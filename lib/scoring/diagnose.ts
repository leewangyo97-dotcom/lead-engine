/**
 * Where the funnel loses leads, dimension by dimension.
 *
 * The pipeline harvested 48 leads in a week and drafted none of them, and there
 * was no way to tell whether that was a filter gone wrong or an honest verdict
 * on what the sources carry. Both look identical from the outside: an empty
 * inbox.
 *
 * The answer is in the score parts, which the app recomputes for one lead at a
 * time on its detail page and never aggregates. Across 322 job leads the average
 * is 33 out of 100, and it is not evenly lost: timezone eligibility averages 7.1
 * of its 30 points with 162 leads scoring nothing at all. That is a supply
 * finding, not a scoring bug — most remote postings are not open to someone in
 * UTC+8 — and it points at sources rather than at weights.
 *
 * Kept pure so it can be tested without a database, and so the script that runs
 * it is only a printer.
 */
export interface DimensionStat {
  key: string;
  max: number;
  average: number;
  /** Average as a percentage of what the dimension could award. */
  share: number;
  /** How many leads scored nothing here — the shape of the loss. */
  zeros: number;
  full: number;
  count: number;
  /** Points lost on average, which is what ranks the dimensions. */
  lost: number;
}

export function summarise(
  parts: readonly Record<string, number>[],
  maxima: Record<string, number>,
): DimensionStat[] {
  return Object.entries(maxima)
    .map(([key, max]) => {
      const values = parts.map((p) => p[key] ?? 0);
      const count = values.length;
      const average = count ? values.reduce((a, b) => a + b, 0) / count : 0;
      return {
        key,
        max,
        average,
        // A dimension nobody can score on is 0% rather than NaN.
        share: max === 0 ? 0 : (average / max) * 100,
        zeros: values.filter((v) => v === 0).length,
        full: values.filter((v) => v === max).length,
        count,
        lost: max - average,
      };
    })
    .sort((a, b) => b.lost - a.lost);
}

/**
 * What the average would become if one dimension were perfect.
 *
 * The headline ranks dimensions by points lost, which answers "where are the
 * points going" and is the wrong question for "what would fix this". Both were
 * conflated on the first reading of this tool: timezone is the largest hole in
 * the job rubric, so the advice was to find timezone-friendly sources — but
 * among the 21 leads that already score full marks on timezone, the average is
 * 57 against a threshold of 75. Fixing the biggest hole would not have been
 * enough, and the tool said nothing about that.
 *
 * So this projects each dimension to its maximum and reports the average that
 * results. A projection that still falls short says the constraint is not one
 * dimension, and no single source change will clear the bar.
 */
export interface Projection {
  key: string;
  /** Average score if every lead scored full marks here, other parts unchanged. */
  projected: number;
  clears: boolean;
}

export function projections(
  parts: readonly Record<string, number>[],
  maxima: Record<string, number>,
  threshold: number,
): Projection[] {
  if (!parts.length) return [];

  const total = (p: Record<string, number>) =>
    Object.keys(maxima).reduce((n, key) => n + (p[key] ?? 0), 0);

  const base = parts.reduce((n, p) => n + total(p), 0) / parts.length;

  return Object.entries(maxima)
    .map(([key, max]) => {
      const gain = parts.reduce((n, p) => n + (max - (p[key] ?? 0)), 0) / parts.length;
      const projected = base + gain;
      return { key, projected, clears: projected >= threshold };
    })
    .sort((a, b) => b.projected - a.projected);
}

/**
 * Dimensions that are not doing any ranking.
 *
 * Found by reading this tool's own first output: every one of 23 funding leads
 * scored 15 of 15 on `pay`. A dimension that awards the same mark to everything
 * is a constant, not a weight — it lifts every score equally and separates
 * nothing, so the rubric is really being decided by the others. The mirror case
 * is a dimension nothing can score on, which is dead weight in the ceiling.
 *
 * Neither is necessarily wrong. Both are worth knowing before anyone tunes a
 * number.
 */
export function inert(stats: readonly DimensionStat[]): DimensionStat[] {
  return stats.filter(
    (s) => s.count > 0 && ((s.full === s.count && s.max > 0) || s.zeros === s.count),
  );
}

/**
 * The one sentence worth reading.
 *
 * Ranked by points lost rather than by percentage: a dimension worth 30 points
 * scoring half is a bigger hole than one worth 5 scoring nothing, and the
 * percentage view hides that.
 */
export function headline(stats: readonly DimensionStat[], threshold: number): string {
  if (!stats.length) return "nothing scored yet";

  const worst = stats[0];
  const ceiling = stats.reduce((n, s) => n + s.average, 0);

  return (
    `The average lead scores ${ceiling.toFixed(0)} of 100 and the draft threshold is ` +
    `${threshold}. The largest hole is ${worst.key}: ${worst.average.toFixed(1)} of ` +
    `${worst.max} on average, with ${worst.zeros} of ${worst.count} scoring nothing.`
  );
}
