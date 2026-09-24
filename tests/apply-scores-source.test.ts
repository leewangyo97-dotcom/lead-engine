import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * `apply:scores` must not relabel a prescore it did not compute.
 *
 * It stamps the row with today's rubric and today's date. It used to leave
 * `preScore` as the nightly prefilter wrote it, days earlier and possibly under
 * an older rubric, so the row claimed a provenance its own figure did not have —
 * and the lead page, reading that row, explained the gap with a false reason.
 */
const SOURCE = readFileSync("scripts/apply-scores.ts", "utf8");

describe("apply:scores", () => {
  it("recomputes preScore in the same write that stamps the rubric and date", () => {
    const from = SOURCE.indexOf(".update(scores)");
    expect(from).toBeGreaterThan(-1);
    const set = SOURCE.slice(from, SOURCE.indexOf(".where(", from));
    expect(set).toMatch(/preScore: prescore\(fromLead\(/);
    expect(set).toMatch(/rubricVer: RUBRIC_VERSION/);
    expect(set).toMatch(/scoredAt: new Date\(\)/);
  });

  it("loads whole leads, since prescore needs more than an id", () => {
    expect(SOURCE).toMatch(/db\.select\(\)\.from\(leads\)/);
  });
});
