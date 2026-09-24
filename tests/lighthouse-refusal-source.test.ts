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

describe("lh when the browser or the database drops out", () => {
  // Built from the script's own pattern, so this tests what actually runs.
  const literal = SOURCE.match(/const BROWSER_GONE = \/(.+)\/i;/);
  const browserGone = new RegExp(literal![1], "i");

  it("reads every browser death as one, including 'Connection closed.'", () => {
    // 24 Sept: the DevTools socket dropped mid-run and the site was blamed.
    for (const m of [
      "Connection closed.",
      "Protocol error (Page.navigate): Target closed",
      "Session closed. Most likely the page has been closed.",
    ]) {
      expect(browserGone.test(m)).toBe(true);
    }
  });

  it("does not read a site's own failure as a browser death", () => {
    for (const m of [
      "lighthouse could not load the page: PAGE_HUNG",
      "lighthouse could not load the page: ERRORED_DOCUMENT_REQUEST",
    ]) {
      expect(browserGone.test(m)).toBe(false);
    }
  });

  it("routes every database write through the retrying writer", () => {
    const updates = [...SOURCE.matchAll(/\.update\(prospects\)/g)];
    expect(updates.length).toBeGreaterThan(0);
    for (const u of updates) {
      expect(SOURCE.slice(Math.max(0, u.index - 60), u.index)).toMatch(/write\(\(\) =>\s*db\s*$/);
    }
  });

  it("stops cleanly with its summary when the database stays gone", () => {
    expect(SOURCE).toMatch(/if \(!\(err instanceof DatabaseGone\)\) throw err;/);
  });

  it("does not count a browser death as a refusal", () => {
    const from = SOURCE.indexOf("report = await measure(");
    const to = SOURCE.indexOf("if (BROWSER_GONE.test(message))", from);
    expect(SOURCE.slice(from, to)).not.toMatch(/refused\+\+/);
  });
});
