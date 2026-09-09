import { describe, expect, it } from "vitest";
import { highlight } from "./highlight";

const joined = (parts: { text: string }[]) => parts.map((p) => p.text).join("");

describe("highlight", () => {
  const body = "I cut the crash rate by 35% and reduced response time by half.";

  it("returns the body untouched when there is nothing to flag", () => {
    expect(highlight(body, [])).toEqual([{ text: body, flagged: false }]);
  });

  it("marks the quoted span and nothing else", () => {
    const parts = highlight(body, ["reduced response time by half"]);
    expect(parts.filter((p) => p.flagged).map((p) => p.text)).toEqual([
      "reduced response time by half",
    ]);
    // Losing or duplicating text would silently rewrite the email on screen.
    expect(joined(parts)).toBe(body);
  });

  it("survives regex characters in a quote", () => {
    // The quote comes from the model and can contain anything. Unescaped, this
    // either throws or matches the wrong span.
    const parts = highlight(body, ["35%"]);
    expect(parts.some((p) => p.flagged && p.text === "35%")).toBe(true);
    expect(joined(parts)).toBe(body);

    const tricky = "Costs (roughly) $40+ per seat [see table].";
    for (const quote of ["(roughly)", "$40+", "[see table]"]) {
      const out = highlight(tricky, [quote]);
      expect(out.some((p) => p.flagged && p.text === quote)).toBe(true);
      expect(joined(out)).toBe(tricky);
    }
  });

  it("ignores a quote the body does not contain", () => {
    // The verifier can quote loosely; a quote that does not appear must not
    // break the pattern or flag something arbitrary.
    const parts = highlight(body, ["a claim that was never written"]);
    expect(parts).toEqual([{ text: body, flagged: false }]);
  });

  it("marks several quotes at once", () => {
    const parts = highlight(body, ["35%", "by half"]);
    expect(parts.filter((p) => p.flagged).map((p) => p.text).sort()).toEqual(["35%", "by half"]);
    expect(joined(parts)).toBe(body);
  });

  it("prefers the longer of two overlapping quotes", () => {
    const parts = highlight(body, ["by half", "reduced response time by half"]);
    expect(parts.filter((p) => p.flagged).map((p) => p.text)).toEqual([
      "reduced response time by half",
    ]);
  });

  it("ignores an empty quote rather than flagging everything", () => {
    expect(highlight(body, [""])).toEqual([{ text: body, flagged: false }]);
  });
});
