import { describe, expect, it } from "vitest";
import { LADDER_DAYS, MAX_STEP, dueAtFor, isDue, ladderRungs } from "./followups";

describe("ladderRungs", () => {
  it("labels the rungs from the ladder rather than hardcoding them", () => {
    expect(ladderRungs(1).map((r) => r.label)).toEqual([
      "Sent",
      `Day ${LADDER_DAYS[0]}`,
      `Day ${LADDER_DAYS[1]}`,
    ]);
  });

  it("marks the first touch done and the first follow-up due", () => {
    expect(ladderRungs(1).map((r) => r.state)).toEqual(["done", "due", "later"]);
  });

  it("moves the due marker along as rungs are sent", () => {
    expect(ladderRungs(2).map((r) => r.state)).toEqual(["done", "done", "due"]);
  });

  it("shows a finished sequence as all done, with nothing owed", () => {
    // Past the last rung there is no next message, and drawing one as "due"
    // would ask for a fourth touch the ladder deliberately does not have.
    const states = ladderRungs(MAX_STEP + 1).map((r) => r.state);
    expect(states).toEqual(["done", "done", "done"]);
    expect(states).not.toContain("due");
  });

  it("has a rung for every step the ladder can reach", () => {
    expect(ladderRungs(0)).toHaveLength(MAX_STEP + 1);
  });
});

describe("dueAtFor", () => {
  it("counts the gap from the last touch", () => {
    const sent = new Date("2026-09-01T00:00:00Z");
    expect(dueAtFor(sent, 1).toISOString()).toBe("2026-09-05T00:00:00.000Z");
  });

  it("refuses a step the ladder has no rung for", () => {
    expect(() => dueAtFor(new Date(), MAX_STEP + 1)).toThrow(/no ladder rung/);
  });
});

describe("isDue", () => {
  const lastSentAt = new Date("2026-09-01T00:00:00Z");
  const at = (iso: string) => ({ lastSentAt, nextStep: 1, hasReplied: false, now: new Date(iso) });

  it("is silent until the gap has passed", () => {
    expect(isDue(at("2026-09-04T23:00:00Z"))).toBe(false);
    expect(isDue(at("2026-09-05T00:00:00Z"))).toBe(true);
  });

  it("is cancelled by a reply", () => {
    expect(isDue({ ...at("2026-09-30T00:00:00Z"), hasReplied: true })).toBe(false);
  });

  it("stops at the end of the ladder", () => {
    expect(isDue({ ...at("2026-09-30T00:00:00Z"), nextStep: MAX_STEP + 1 })).toBe(false);
  });
});
