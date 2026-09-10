import { describe, expect, it } from "vitest";
import { classifyHealth, formatCount } from "./nav-status";

describe("formatCount", () => {
  it("prints small counts exactly, which is the normal case", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(7)).toBe("7");
    expect(formatCount(345)).toBe("345");
  });

  it("prints the last exact value before the cap", () => {
    expect(formatCount(999)).toBe("999");
  });

  it("caps above a thousand rather than widening the sidebar", () => {
    // The real number the day a country-wide search landed.
    expect(formatCount(7627)).toBe("999+");
    expect(formatCount(1000)).toBe("999+");
  });
});

describe("classifyHealth", () => {
  it("calls a failing source a fault, not a warning", () => {
    expect(classifyHealth(1, 0).health).toBe("fault");
  });

  it("calls a source that has not run recently a warning", () => {
    expect(classifyHealth(0, 2).health).toBe("warn");
  });

  it("lets a failure outrank staleness", () => {
    expect(classifyHealth(1, 3).healthLabel).toMatch(/failing/);
  });

  it("says all is well only when it is", () => {
    expect(classifyHealth(0, 0)).toEqual({ health: "ok", healthLabel: "All systems normal" });
  });
});
