import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * discover.yml runs two ways: a job started from /people, and a weeknight
 * schedule that takes the next prospects by score. The schedule only makes
 * sense after nightly.yml has enriched and scored them.
 */
const DISCOVER = readFileSync(".github/workflows/discover.yml", "utf8");
const NIGHTLY = readFileSync(".github/workflows/nightly.yml", "utf8");

const minutes = (cron: string) => {
  const [minute, hour] = cron.split(" ").map(Number);
  return hour * 60 + minute;
};
const firstCron = (text: string) => text.match(/-\s*cron:\s*['"]([^'"]+)['"]/)?.[1] ?? "";

describe("discover.yml", () => {
  it("can still be started from /people with a job id", () => {
    expect(DISCOVER).toMatch(/workflow_dispatch:\s*\n\s*inputs:\s*\n\s*job_id:/);
    expect(DISCOVER).toContain("pnpm -s people:discover --job=\"$JOB_ID\"");
  });

  it("runs on weeknights after the nightly has had its whole time budget", () => {
    const discover = firstCron(DISCOVER);
    const nightly = firstCron(NIGHTLY);
    const budget = Number(NIGHTLY.match(/timeout-minutes:\s*(\d+)/)?.[1]);
    expect(discover.endsWith("* * 1-5")).toBe(true);
    expect(nightly.endsWith("* * 1-5")).toBe(true);
    expect(minutes(discover)).toBeGreaterThanOrEqual(minutes(nightly) + budget);
  });

  it("takes the next prospects by score when nobody started it", () => {
    expect(DISCOVER).toContain('pnpm -s people:discover --seed=prospects --limit="$NIGHTLY_LIMIT"');
  });

  it("passes the job id through the environment, never into the script", () => {
    const run = DISCOVER.slice(DISCOVER.indexOf("run: |"), DISCOVER.indexOf("env:", DISCOVER.indexOf("run: |")));
    expect(run).not.toContain("${{");
    expect(DISCOVER).toContain("JOB_ID: ${{ inputs.job_id }}");
  });
});
