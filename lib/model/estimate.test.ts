import { describe, expect, it } from "vitest";
import { CHARS_PER_TOKEN, estimateTokens, judgeBudget, sizeOf } from "./estimate";

describe("estimateTokens", () => {
  it("is empty for empty input rather than one token", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("rounds up, so a short string never estimates as free", () => {
    expect(estimateTokens("a")).toBe(1);
    expect(estimateTokens("a".repeat(CHARS_PER_TOKEN))).toBe(1);
    expect(estimateTokens("a".repeat(CHARS_PER_TOKEN + 1))).toBe(2);
  });

  it("scales with length, which is the property the check relies on", () => {
    // The failure this guards against is a payload several times its usual
    // size, so proportionality matters and precision does not.
    const small = estimateTokens("x".repeat(1_000));
    const large = estimateTokens("x".repeat(10_000));
    expect(large).toBe(small * 10);
  });
});

describe("sizeOf", () => {
  it("carries the row count so a payload can be read per row", () => {
    const size = sizeOf("drafting", 7, JSON.stringify({ leads: [] }));
    expect(size.name).toBe("drafting");
    expect(size.rows).toBe(7);
    expect(size.chars).toBe(12);
    expect(size.estimatedTokens).toBe(3);
  });
});

describe("sizeOf with no countable rows", () => {
  it("keeps null rather than calling a prose prompt empty", () => {
    // The enhance prompt is written prose with businesses inside it. Reported
    // as rows=0 it reads as "nothing to send tonight", which is the opposite of
    // what a 1,600-token payload means.
    expect(sizeOf("enhance", null, "a prompt with businesses in it").rows).toBeNull();
  });
});

describe("judgeBudget", () => {
  const target = 25_000;
  const ceiling = 40_000;

  it("is within budget below the target", () => {
    expect(judgeBudget(22_000, target, ceiling).state).toBe("within");
  });

  it("names the target when over it but under the ceiling", () => {
    const verdict = judgeBudget(30_000, target, ceiling);
    expect(verdict.state).toBe("over-target");
    expect(verdict.message).toContain("25000");
  });

  it("blames the filter when over the ceiling, because that is what it is", () => {
    const verdict = judgeBudget(90_000, target, ceiling);
    expect(verdict.state).toBe("over-ceiling");
    expect(verdict.message).toMatch(/stopped filtering/);
  });

  it("treats the boundaries as inside the budget", () => {
    expect(judgeBudget(target, target, ceiling).state).toBe("within");
    expect(judgeBudget(ceiling, target, ceiling).state).toBe("over-target");
  });
});
