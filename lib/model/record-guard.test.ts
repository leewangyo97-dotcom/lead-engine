import { describe, expect, it } from "vitest";
import { checkCounts } from "./record-guard";

const run = { afterFilter: 2, scoredCount: 0 };

describe("checkCounts", () => {
  it("refuses the exact figures that got into production", () => {
    // The usage line reads `--in 6000 --out 1200 --scored 18 --drafted 7`. Those
    // were run verbatim against a night where two leads survived the filter, and
    // run_metrics recorded 18 scored against afterFilter 2.
    const result = checkCounts(run, { scored: 18, drafted: 7 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/more than the 2 lead\(s\)/);
  });

  it("allows a figure the funnel can support", () => {
    expect(checkCounts(run, { scored: 2, drafted: 1 })).toEqual({ ok: true });
  });

  it("allows scoring everything that survived", () => {
    expect(checkCounts(run, { scored: 2 })).toEqual({ ok: true });
  });

  it("refuses more drafts than leads scored in the same call", () => {
    const result = checkCounts({ afterFilter: 10, scoredCount: 0 }, { scored: 3, drafted: 5 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/more than the 3 lead\(s\) scored/);
  });

  it("checks drafts against what the run already holds when scored is not being set", () => {
    // Correcting the draft count alone still has to agree with the run.
    const result = checkCounts({ afterFilter: 10, scoredCount: 4 }, { drafted: 6 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/more than the 4 lead\(s\) scored/);
  });

  it("refuses negatives", () => {
    expect(checkCounts(run, { scored: -1 }).ok).toBe(false);
    expect(checkCounts(run, { drafted: -1 }).ok).toBe(false);
  });

  it("passes a call that sets no counts at all", () => {
    // Token figures with no counts is a legitimate call, and the guard has
    // nothing to say about it.
    expect(checkCounts(run, {})).toEqual({ ok: true });
  });

  it("allows zero, which is what a night with no model work looks like", () => {
    expect(checkCounts(run, { scored: 0, drafted: 0 })).toEqual({ ok: true });
  });
});
