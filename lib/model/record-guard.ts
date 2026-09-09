/**
 * Refuses funnel counts that the run itself contradicts.
 *
 * `tokens:record` takes its numbers from a person, because the model calls
 * happen inside Claude Code and nothing server-side can observe them. That makes
 * it the one write path in this project with no evidence behind it, and it was
 * used with the example figures out of a usage line — `--scored 18 --drafted 7`
 * against a run where two leads survived the filter. Nothing objected, and
 * `run_metrics` held a number that could not have happened.
 *
 * The run's own deterministic counts are the evidence. They are written by the
 * harvest, they are not typed by anyone, and they bound what the model can
 * possibly have done: it cannot score more leads than reached it, and it cannot
 * draft for more leads than it scored.
 *
 * This does not make a recorded figure true. It makes an impossible one loud.
 */
export interface RunCounts {
  /** Leads that survived the pre-filter, so the most the model could have scored. */
  afterFilter: number;
  /** What is already recorded for this run, when the caller is not changing it. */
  scoredCount: number | null;
}

export interface RecordedCounts {
  scored?: number;
  drafted?: number;
}

export function checkCounts(
  run: RunCounts,
  input: RecordedCounts,
): { ok: true } | { ok: false; reason: string } {
  const { scored, drafted } = input;

  if (scored !== undefined && scored < 0) {
    return { ok: false, reason: "--scored cannot be negative" };
  }
  if (drafted !== undefined && drafted < 0) {
    return { ok: false, reason: "--drafted cannot be negative" };
  }

  if (scored !== undefined && scored > run.afterFilter) {
    return {
      ok: false,
      reason:
        `--scored ${scored} is more than the ${run.afterFilter} lead(s) that survived the ` +
        "pre-filter on this run. Either the figure belongs to a different run, or it is a " +
        "placeholder — run_metrics must not hold a number that could not have happened.",
    };
  }

  // Against the figure being recorded now when there is one, and against what
  // the run already holds when there is not.
  const scoredTotal = scored ?? run.scoredCount;
  if (drafted !== undefined && scoredTotal != null && drafted > scoredTotal) {
    return {
      ok: false,
      reason:
        `--drafted ${drafted} is more than the ${scoredTotal} lead(s) scored on this run. ` +
        "A draft is written for a lead the scorer passed, so this cannot be right.",
    };
  }

  return { ok: true };
}
