import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SCHEDULE_HOUR_UTC, SCHEDULE_MINUTE_UTC } from "../lib/health";

/**
 * The schedule is written down twice, so something has to check the two copies
 * agree.
 *
 * `expectedLastRun` decides whether a night was missed by computing when the
 * run was due. It cannot read the workflow file at runtime — it is pure so CI
 * can exercise it without a database — so it carries its own copy of the cron.
 * That copy went stale the moment the cron moved off the hour: the code kept
 * computing 20:00 while GitHub fired at 20:17, and nothing failed to say so.
 *
 * Six hours of grace absorbed the seventeen minutes, so the drift never showed
 * as a false fault. This test exists because the next edit to the cron might
 * not be seventeen minutes.
 */
const WORKFLOW = ".github/workflows/nightly.yml";

/** Every `- cron: '...'` line in the workflow, in file order. */
function crons(): string[] {
  const text = readFileSync(WORKFLOW, "utf8");
  return [...text.matchAll(/-\s*cron:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

describe("the nightly schedule", () => {
  it("still has a weekday harvest and a monthly retention entry", () => {
    expect(crons()).toHaveLength(2);
  });

  it("fires at the hour and minute lib/health.ts computes against", () => {
    const [harvest] = crons();
    const [minute, hour] = harvest.split(/\s+/);

    expect(Number(hour)).toBe(SCHEDULE_HOUR_UTC);
    expect(Number(minute)).toBe(SCHEDULE_MINUTE_UTC);
  });

  it("runs weekdays only, which is what expectedLastRun walks back over", () => {
    const [harvest] = crons();
    const [, , dom, month, dow] = harvest.split(/\s+/);

    expect(dom).toBe("*");
    expect(month).toBe("*");
    expect(dow).toBe("1-5");
  });
});
