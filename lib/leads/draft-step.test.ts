import { describe, expect, it } from "vitest";
import { checkStep } from "./draft-step";

const at = (step: number, highestSentStep: number | null, hasUnsentDraft = false) =>
  checkStep({ step, highestSentStep, hasUnsentDraft });

describe("checkStep", () => {
  it("allows a first touch when nothing has been sent", () => {
    expect(at(0, null).ok).toBe(true);
  });

  it("refuses a second first touch", () => {
    // This is the bug that made the fix necessary: a day-4 nudge stored as step
    // 0 becomes a second opening email, and the ladder never advances.
    const out = at(0, 0);
    expect(out.ok).toBe(false);
    expect(out.reason).toMatch(/a follow-up is step 1/);
  });

  it("allows the next rung after a send", () => {
    expect(at(1, 0).ok).toBe(true);
    expect(at(2, 1).ok).toBe(true);
  });

  it("refuses a rung that skips one", () => {
    expect(at(2, 0).reason).toMatch(/next rung is 1/);
  });

  it("refuses a follow-up before anything has been sent", () => {
    expect(at(1, null).reason).toMatch(/nothing has been sent/);
  });

  it("refuses a second copy of a rung already written and unsent", () => {
    // Otherwise a re-run of the drafting step quietly doubles the nudge.
    expect(at(1, 0, true).reason).toMatch(/already written and unsent/);
  });

  it("refuses to go past the end of the ladder", () => {
    // Three touches is the whole sequence; a fourth is pestering.
    expect(at(3, 2).reason).toMatch(/past the end of the ladder/);
  });
});
