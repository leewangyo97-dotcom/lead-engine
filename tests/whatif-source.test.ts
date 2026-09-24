import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The rubric what-if on /rejected may only count what a reweighting could move.
 *
 * It rescored every turned-away lead with the rubric alone, so on 24 Sept "as
 * scored today" listed Lucia at 92 and Search Atlas at 83 as qualifying — both
 * scored 0 by the model as not engineering roles — and the full-time scenario
 * counted two Proxybase roles disqualified for Rust. Four "would qualify"; the
 * honest figure was none.
 */
const SOURCE = readFileSync("lib/leads/whatif.ts", "utf8");

describe("getScenarios", () => {
  it("leaves out disqualified leads, which no weight can clear", () => {
    expect(SOURCE).toMatch(/inArray\(leads\.status, \["parked", "needs_scoring"\]\)/);
    expect(SOURCE).not.toMatch(/"disqualified"/);
  });

  it("holds a model verdict fixed and adds only the change the weights make", () => {
    expect(SOURCE).toMatch(
      /model == null \? scenario : model \+ \(scenario - prescore\(fromLead\(lead\), now\)\.score\)/,
    );
  });
});
