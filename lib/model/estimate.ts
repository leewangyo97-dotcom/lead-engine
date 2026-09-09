/**
 * A size estimate for a model payload, in tokens.
 *
 * `run_metrics` has columns for what a run actually cost, and they are filled in
 * by hand from the session that made the calls, because the model calls happen
 * inside Claude Code rather than server-side. That leaves a gap: until someone
 * runs a night and reports the numbers, nobody can tell whether a payload has
 * quietly grown past the budget in `docs/05-TOKEN-BUDGET.md`.
 *
 * This closes the gap from the other side. The payloads are produced by
 * deterministic code, so their size can be checked at any time without a model
 * being involved at all — and input dominates the bill here, since the funnel
 * exists precisely to keep the number of output tokens small.
 *
 * It is an estimate and is labelled one everywhere it is shown. The rule of four
 * characters to a token is a rough average for English prose and JSON; it is not
 * a tokeniser, and a real count needs the model that will read the text. What it
 * is good for is the thing that actually goes wrong — a filter that stopped
 * filtering, which shows up as a payload several times its usual size, not as a
 * ten-percent drift.
 */
export const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export interface PayloadSize {
  name: string;
  /**
   * Rows the payload carries, so a size can be read per row, or null when the
   * payload is prose and there is nothing to count. Null rather than zero: a
   * prompt with five businesses written into it is not a payload with no rows,
   * and printing 0 would report the pipeline as empty when it is not.
   */
  rows: number | null;
  chars: number;
  estimatedTokens: number;
}

export function sizeOf(name: string, rows: number | null, text: string): PayloadSize {
  return { name, rows, chars: text.length, estimatedTokens: estimateTokens(text) };
}

export interface BudgetVerdict {
  total: number;
  state: "within" | "over-target" | "over-ceiling";
  message: string;
}

/**
 * The same two thresholds `pnpm tokens` uses for measured runs, applied to the
 * estimate. Deliberately the same numbers: two budgets that disagree would mean
 * neither is the budget.
 */
export function judgeBudget(total: number, target: number, ceiling: number): BudgetVerdict {
  if (total > ceiling) {
    return {
      total,
      state: "over-ceiling",
      message:
        `payloads estimate ${total} tokens, over the ${ceiling} ceiling. ` +
        "A filter has almost certainly stopped filtering — check the row counts above.",
    };
  }
  if (total > target) {
    return {
      total,
      state: "over-target",
      message: `payloads estimate ${total} tokens, over the ${target} target but under the ceiling.`,
    };
  }
  return {
    total,
    state: "within",
    message: `payloads estimate ${total} tokens, within the ${target} target.`,
  };
}
