import { describe, expect, it } from "vitest";
import { MIN_SENDS, proposeChange, type Cut } from "./rollup";
import { LADDER_DAYS, MAX_STEP, isDue } from "../followups";

const cut = (key: string, sends: number, replies: number): Cut => ({
  key,
  sends,
  replies,
  replyRate: sends >= MIN_SENDS ? replies / sends : null,
});

describe("rubric suggestions", () => {
  it("says nothing before there is enough evidence", () => {
    const cuts = [cut("crash-rate", 8, 4), cut("years", 8, 0)];
    // A real gap, but only 16 sends total — below the bar for any claim.
    expect(proposeChange(cuts, 16)).toBeNull();
  });

  it("says nothing when the gap is within noise", () => {
    const cuts = [cut("a", 10, 3), cut("b", 10, 2)];
    expect(proposeChange(cuts, 20)).toBeNull();
  });

  it("proposes a change when the evidence is real, and cites the counts", () => {
    const cuts = [cut("crash-rate", 11, 4), cut("years", 9, 0)];
    const suggestion = proposeChange(cuts, 20);
    expect(suggestion).toContain("crash-rate");
    expect(suggestion).toContain("4/11");
    expect(suggestion).toContain("0/9");
  });

  it("never claims to have applied anything", () => {
    const suggestion = proposeChange([cut("a", 11, 5), cut("b", 9, 0)], 20) ?? "";
    expect(suggestion).toMatch(/nothing is applied automatically/i);
  });

  it("ignores cuts too small to have a rate", () => {
    // Three sends cannot produce a finding no matter how lopsided.
    const cuts = [cut("tiny", 3, 3), cut("real", 10, 1)];
    expect(proposeChange(cuts, 25)).toBeNull();
  });
});

describe("follow-up ladder", () => {
  const now = new Date("2026-09-20T00:00:00Z");
  const daysBefore = (n: number) => new Date(now.getTime() - n * 86_400_000);

  it("comes due on the ladder day and not before", () => {
    expect(isDue({ lastSentAt: daysBefore(3), nextStep: 1, hasReplied: false, now })).toBe(false);
    expect(isDue({ lastSentAt: daysBefore(LADDER_DAYS[0]), nextStep: 1, hasReplied: false, now })).toBe(true);
  });

  it("cancels the moment a reply is logged", () => {
    expect(isDue({ lastSentAt: daysBefore(30), nextStep: 1, hasReplied: true, now })).toBe(false);
  });

  it("stops after the last rung rather than nagging forever", () => {
    expect(isDue({ lastSentAt: daysBefore(90), nextStep: MAX_STEP + 1, hasReplied: false, now })).toBe(false);
  });

  it("owes nothing when nothing was sent", () => {
    expect(isDue({ lastSentAt: null, nextStep: 1, hasReplied: false, now })).toBe(false);
  });

  it("measures from the last touch, so a late first follow-up delays the second", () => {
    // Day-4 note went out yesterday; day-11 must not arrive today.
    expect(isDue({ lastSentAt: daysBefore(1), nextStep: 2, hasReplied: false, now })).toBe(false);
    expect(isDue({ lastSentAt: daysBefore(LADDER_DAYS[1]), nextStep: 2, hasReplied: false, now })).toBe(true);
  });
});
