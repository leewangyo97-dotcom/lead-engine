import { describe, expect, it } from "vitest";
import { estimateTokens, judgeBudget, sizeOf } from "./estimate";

describe("estimateTokens", () => {
  it("is empty for empty input rather than one token", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("never reports a non-empty string as free", () => {
    expect(estimateTokens("a")).toBeGreaterThan(0);
  });

  it("counts real tokens rather than dividing by four", () => {
    // JSON is where the character ratio was worst, and where this budget lives:
    // it read 282 against the tokeniser's 342 on the scoring emitter. Punctuation
    // costs tokens that a length-based guess spreads away.
    const json = JSON.stringify({ count: 3, leads: [{ company: "Reef", title: "Senior Python" }] });
    expect(estimateTokens(json)).toBeGreaterThan(Math.ceil(json.length / 4));
  });

  it("scales with length, which is the property the check relies on", () => {
    // The failure this guards against is a payload several times its usual
    // size, so proportionality matters and precision does not.
    const small = estimateTokens("word ".repeat(100));
    const large = estimateTokens("word ".repeat(1_000));
    expect(large).toBeGreaterThan(small * 8);
  });
});

describe("sizeOf", () => {
  it("carries the row count so a payload can be read per row", () => {
    const size = sizeOf("drafting", 7, JSON.stringify({ leads: [] }));
    expect(size.name).toBe("drafting");
    expect(size.rows).toBe(7);
    expect(size.chars).toBe(12);
    expect(size.estimatedTokens).toBeGreaterThan(0);
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
