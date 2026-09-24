import { describe, expect, it } from "vitest";
import { scoreDivergence } from "./divergence";
import { RUBRIC_VERSION, prescore, type PrescoreInput } from "./prescore";

const POSTED = new Date("2026-09-01T00:00:00Z");
const day = (n: number) => new Date(POSTED.getTime() + n * 86_400_000);

const lead: PrescoreInput = {
  title: "Software Engineer",
  summary: "Python, FastAPI. Remote worldwide.",
  region: "REMOTE Worldwide",
  remoteScope: "worldwide",
  isContract: false,
  isDirect: true,
  contact: "atlas@example.com",
  payMinUsdHr: null,
  stack: ["fastapi"],
  postedAt: POSTED,
};

describe("scoreDivergence", () => {
  it("is none when today's figure matches the stored one", () => {
    const stored = { preScore: prescore(lead, day(10)).score, rubricVer: RUBRIC_VERSION, scoredAt: day(10) };
    expect(scoreDivergence(lead, stored, day(12))).toBe("none");
  });

  // The CyberAtlas case: scored at three weeks, shown a few days later, same
  // rubric throughout. Freshness fell from 3 to 0 and the page blamed the
  // weights, which had not changed.
  it("blames the posting's age, not the weights, when only the clock moved", () => {
    const scoredAt = day(10);
    const stored = { preScore: prescore(lead, scoredAt).score, rubricVer: RUBRIC_VERSION, scoredAt };
    const today = day(23);
    expect(prescore(lead, today).score).toBeLessThan(stored.preScore);
    expect(scoreDivergence(lead, stored, today)).toBe("age");
  });

  it("blames the weights only when the rubric version differs", () => {
    const stored = { preScore: 1, rubricVer: "1.1.0", scoredAt: day(10) };
    expect(scoreDivergence(lead, stored, day(23))).toBe("rubric");
  });

  it("says the lead changed when neither the rubric nor the clock explains it", () => {
    const scoredAt = day(10);
    const stored = {
      // Ten points of direct contact: more than freshness can ever be worth,
      // so no posting age can account for it.
      preScore: prescore({ ...lead, isDirect: false, contact: null }, scoredAt).score,
      rubricVer: RUBRIC_VERSION,
      scoredAt,
    };
    expect(scoreDivergence(lead, stored, day(23))).toBe("inputs");
  });

  // The real CyberAtlas row: the prefilter computed 75 at eleven days old, the
  // model scored it at twenty-three and restamped `scoredAt`. Reconstructing
  // from `scoredAt` alone gives 72 and wrongly blames the lead's own details.
  it("still finds the age when scoredAt was restamped after the prescore", () => {
    const stored = { preScore: prescore(lead, day(11)).score, rubricVer: RUBRIC_VERSION, scoredAt: day(23) };
    expect(prescore(lead, day(23)).score).not.toBe(stored.preScore);
    expect(scoreDivergence(lead, stored, day(23))).toBe("age");
  });

  it("never credits age for a lead with no posting date", () => {
    const undated = { ...lead, postedAt: null };
    const stored = { preScore: 99, rubricVer: RUBRIC_VERSION, scoredAt: day(1) };
    expect(scoreDivergence(undated, stored, day(2))).toBe("inputs");
  });
});
