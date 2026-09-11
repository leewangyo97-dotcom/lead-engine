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

/**
 * Every cron string a job's `if:` compares against.
 *
 * The schedule is written down four times, not twice: the two `cron:` entries
 * and the two gates that decide which job a fired schedule belongs to. This
 * file only ever checked the first two.
 */
function gatedSchedules(): string[] {
  const text = readFileSync(WORKFLOW, "utf8");
  return [
    ...text.matchAll(/if:\s*github\.event\.schedule\s*[!=]=\s*['"]([^'"]+)['"]/g),
  ].map((m) => m[1]);
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

/**
 * The bug this pair of tests exists for.
 *
 * On 3 September both crons moved from the hour to :17, to dodge the most
 * contended minute on GitHub's scheduler. The two `if:` gates still compared
 * against `'0 20 1 * *'`, so from 1 October the monthly retention job would
 * never have run again — its gate could not match any schedule the workflow
 * declares — while harvest would have run twice on the 1st instead.
 *
 * Retention did run on 1 September, when the strings still agreed, which is how
 * the breakage was confined to a future date rather than an obvious failure.
 * Nothing failed. The workflow was valid YAML and every run was green.
 */
describe("the job gates and the schedule they gate on", () => {
  it("compares against a cron the workflow actually declares", () => {
    for (const gated of gatedSchedules()) {
      expect(crons()).toContain(gated);
    }
  });

  it("gates both jobs on the monthly entry, which is the one that disambiguates", () => {
    // The weekday cron fires the harvest and nothing else; the monthly one is
    // the only schedule a job has to be told apart by.
    const [, monthly] = crons();
    expect(gatedSchedules()).toEqual([monthly, monthly]);
  });
});
