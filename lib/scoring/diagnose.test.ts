import { describe, expect, it } from "vitest";
import { headline, inert, summarise } from "./diagnose";

const MAXIMA = { timezone: 30, stack: 25, contract: 20 };

describe("summarise", () => {
  it("averages each dimension and counts the zeros", () => {
    const stats = summarise(
      [
        { timezone: 30, stack: 0, contract: 20 },
        { timezone: 0, stack: 0, contract: 10 },
      ],
      MAXIMA,
    );
    const timezone = stats.find((s) => s.key === "timezone")!;
    expect(timezone.average).toBe(15);
    expect(timezone.share).toBe(50);
    expect(timezone.zeros).toBe(1);
    expect(timezone.full).toBe(1);
    expect(timezone.count).toBe(2);
  });

  it("ranks by points lost, not by percentage", () => {
    // stack loses 25 of 25; contract loses 10 of 20. As percentages that is
    // 100% against 50%, and as points it is 25 against 10 — but a dimension
    // worth 5 scoring nothing must not outrank one worth 30 scoring half.
    const stats = summarise(
      [
        { timezone: 15, stack: 0, contract: 10 },
        { timezone: 15, stack: 0, contract: 10 },
      ],
      MAXIMA,
    );
    expect(stats.map((s) => s.key)).toEqual(["stack", "timezone", "contract"]);
  });

  it("treats a missing part as zero rather than skipping the lead", () => {
    const stats = summarise([{ timezone: 30 }], MAXIMA);
    expect(stats.find((s) => s.key === "stack")!.average).toBe(0);
    expect(stats.find((s) => s.key === "stack")!.zeros).toBe(1);
  });

  it("returns zeros rather than NaN when nothing has been scored", () => {
    const stats = summarise([], MAXIMA);
    expect(stats.every((s) => s.average === 0 && s.share === 0 && s.count === 0)).toBe(true);
  });

  it("does not divide by a dimension worth nothing", () => {
    expect(summarise([{ x: 0 }], { x: 0 })[0].share).toBe(0);
  });
});

describe("inert", () => {
  it("flags a dimension every lead scores full marks on", () => {
    // The real case: 23 funding leads, all 15 of 15 on pay. It lifts every score
    // by the same 15 and separates nothing.
    const stats = summarise([{ pay: 15 }, { pay: 15 }], { pay: 15 });
    expect(inert(stats).map((s) => s.key)).toEqual(["pay"]);
  });

  it("flags a dimension nothing can score on", () => {
    const stats = summarise([{ stack: 0 }, { stack: 0 }], { stack: 25 });
    expect(inert(stats).map((s) => s.key)).toEqual(["stack"]);
  });

  it("leaves a dimension that actually separates leads alone", () => {
    const stats = summarise([{ stack: 25 }, { stack: 0 }, { stack: 10 }], { stack: 25 });
    expect(inert(stats)).toEqual([]);
  });

  it("says nothing when nothing has been scored", () => {
    expect(inert(summarise([], { stack: 25 }))).toEqual([]);
  });
});

describe("headline", () => {
  it("names the largest hole and the gap to the threshold", () => {
    const stats = summarise(
      [
        { timezone: 0, stack: 10, contract: 20 },
        { timezone: 0, stack: 10, contract: 20 },
      ],
      MAXIMA,
    );
    const line = headline(stats, 75);
    expect(line).toContain("30 of 100");
    expect(line).toContain("threshold is 75");
    expect(line).toMatch(/largest hole is timezone/);
    expect(line).toContain("2 of 2 scoring nothing");
  });

  it("says so when there is nothing to report", () => {
    expect(headline([], 75)).toBe("nothing scored yet");
  });
});
