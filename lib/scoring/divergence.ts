import { RUBRIC_VERSION, prescore, type PrescoreInput } from "./prescore";

/**
 * Why a stored prescore differs from the one computed today.
 *
 * The lead page recomputes the breakdown rather than reading it back, so the
 * two can disagree, and it used to give one reason whatever the cause: "the
 * weights changed after this lead was scored". CyberAtlas was scored under
 * 1.2.0 on the day it was shown under 1.2.0 and read 75 stored against 72
 * computed, with that sentence beneath it. Nothing had changed but the date —
 * trigger freshness is worth 3 at three weeks and 0 a few days later.
 *
 * So the reason is established rather than assumed, in the order that settles
 * it cheapest:
 *
 *   rubric  the version differs, so the weights did change
 *   age     same rubric, and some posting age reproduces the stored figure —
 *           the only thing that moved is the clock
 *   inputs  same rubric and not the clock, so the lead itself changed after it
 *           was scored; nothing here can say which field
 *
 * `scoredAt` cannot answer the age question on its own: `apply:scores` used to
 * restamp it when the model scored, leaving a `preScore` the nightly prefilter
 * had computed days earlier. So every age is tried instead. Freshness is the
 * one input that depends on time, so if any age reproduces the figure, age is
 * the honest explanation — and scanning means the freshness bands are not
 * written down a second time here, where a change to them would go unnoticed.
 */

/** Past every freshness band either lead kind has; beyond it, age changes nothing. */
const MAX_SCAN_DAYS = 120;

export type Divergence = "none" | "rubric" | "age" | "inputs";

export function scoreDivergence(
  input: PrescoreInput,
  stored: { preScore: number; rubricVer: string; scoredAt: Date },
  now = new Date(),
): Divergence {
  if (prescore(input, now).score === stored.preScore) return "none";
  if (stored.rubricVer !== RUBRIC_VERSION) return "rubric";
  const posted = input.postedAt;
  if (!posted) return "inputs"; // no date, so no freshness, so age explains nothing
  for (let days = 0; days <= MAX_SCAN_DAYS; days++) {
    const then = new Date(posted.getTime() + days * 86_400_000);
    if (prescore(input, then).score === stored.preScore) return "age";
  }
  return "inputs";
}
