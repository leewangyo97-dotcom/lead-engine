import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * A site that refused to load must not come back to the front of every queue.
 *
 * Nothing was written when a site refused — right about the reading, wrong
 * about the row. It kept `lighthouse` null, so the next batch selected it
 * again. Forty-four of the first 150-row run were refusals; all forty-four
 * would have been retried in every later run, each costing up to the full
 * 20-second wait, and the share only grows as measurable rows are consumed.
 */
const SOURCE = readFileSync("scripts/lighthouse.ts", "utf8");

describe("lh and sites that refuse", () => {
  it("records the refusal under a key that is not a reading", () => {
    // `storedLighthouse` reads `lighthouse`. If a refusal were written there,
    // a note about a 404 would reach the score, the findings and the drafts as
    // though it were a measurement of the page.
    expect(SOURCE).toMatch(/lighthouseRefused: \{ at: /);
    expect(SOURCE).not.toMatch(/lighthouse: \{ at: /);
  });

  it("skips recently refused rows when building the queue", () => {
    // Writing the record and not reading it would change nothing at all.
    expect(SOURCE).toMatch(/'lighthouseRefused' ->> 'at' is null/);
    expect(SOURCE).toMatch(/now\(\) - \$\{`\$\{REFUSAL_COOLDOWN_DAYS\} days`\}::interval/);
  });

  it("lets them back in rather than blacklisting them for good", () => {
    expect(SOURCE).toMatch(/const REFUSAL_COOLDOWN_DAYS = \d+;/);
  });

  // The distinction that matters. A dead browser and a dead site produce the
  // same thrown error at this level, and only one of them is the site's doing.
  it("does not blame the site when our own browser died", () => {
    const from = SOURCE.indexOf("if (BROWSER_GONE.test(message))");
    expect(from).toBeGreaterThan(-1);
    // Everything between the browser-death branch and the first refusal record
    // below it. That branch has to leave by its own `continue`, or it falls
    // through and puts a month's cooldown on a site that did nothing wrong.
    const escape = SOURCE.slice(from, SOURCE.indexOf("await noteRefusal(", from));
    expect(escape).toMatch(/continue;/);
    expect(escape).toMatch(/chromeLauncher\.launch/);
  });

  it("writes nothing under --dry", () => {
    const calls = [...SOURCE.matchAll(/await noteRefusal\(/g)];
    expect(calls).toHaveLength(2);
    for (const m of calls) {
      expect(SOURCE.slice(m.index - 10, m.index)).toBe("if (!dry) ");
    }
  });
});
