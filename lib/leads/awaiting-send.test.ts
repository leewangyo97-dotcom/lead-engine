import { describe, expect, it } from "vitest";
import { COLD_DRAFT_DAYS, STALE_DRAFT_DAYS, ageOf } from "./awaiting-send";

describe("ageOf", () => {
  it("calls a draft written today fresh", () => {
    expect(ageOf(0)).toBe("fresh");
    expect(ageOf(STALE_DRAFT_DAYS - 1)).toBe("fresh");
  });

  it("calls it stale once a posting starts going cold", () => {
    // Five days is where a job thread is buried and the role may be filled.
    expect(ageOf(STALE_DRAFT_DAYS)).toBe("stale");
    expect(ageOf(COLD_DRAFT_DAYS - 1)).toBe("stale");
  });

  it("calls it cold when the posting has probably closed", () => {
    expect(ageOf(COLD_DRAFT_DAYS)).toBe("cold");
    expect(ageOf(90)).toBe("cold");
  });

  it("puts the boundaries in that order, whatever the constants become", () => {
    // The thresholds are meant to be tuned; the ordering is not.
    expect(STALE_DRAFT_DAYS).toBeLessThan(COLD_DRAFT_DAYS);
  });
});
