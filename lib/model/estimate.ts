import { encode } from "gpt-tokenizer";

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
 * It counts with a real byte-pair tokeniser rather than dividing by four.
 *
 * The four-characters rule was close on prose and wrong where it mattered: the
 * JSON payloads this budget exists to guard came out 18% under on the scoring
 * emitter and 20% under on a small sample — the budget was optimistic in exactly
 * the direction that hides a regression. Measured against the real emitters,
 * chars/4 read 282 where the tokeniser reads 342, and 1,736 where it reads
 * 1,792.
 *
 * Still an estimate, and still labelled one. `gpt-tokenizer` implements
 * OpenAI's BPE, and the model reading these payloads is Claude, whose tokeniser
 * is not the same one. It is a much better approximation than a character ratio
 * and it is not an exact count, so nothing here claims to be measuring the bill.
 * What it is good for is unchanged: catching a payload several times its usual
 * size because a filter stopped filtering.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return encode(text).length;
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
