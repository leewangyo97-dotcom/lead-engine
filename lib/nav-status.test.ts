import { describe, expect, it } from "vitest";
import { classifyHealth } from "./nav-status";

describe("classifyHealth", () => {
  it("reports all clear only when nothing is wrong", () => {
    expect(classifyHealth(0, 0)).toEqual({ health: "ok", healthLabel: "All systems normal" });
  });

  it("calls a failing source a fault", () => {
    expect(classifyHealth(1, 0)).toEqual({ health: "fault", healthLabel: "1 source failing" });
    expect(classifyHealth(3, 0).healthLabel).toBe("3 sources failing");
  });

  it("calls a source that has not run recently a warning, not a fault", () => {
    expect(classifyHealth(0, 2)).toEqual({ health: "warn", healthLabel: "2 sources stale" });
  });

  it("shows the fault when a source is both failing and stale", () => {
    // Saying "stale" about a source that is actually failing understates it.
    expect(classifyHealth(1, 4).health).toBe("fault");
  });
});
