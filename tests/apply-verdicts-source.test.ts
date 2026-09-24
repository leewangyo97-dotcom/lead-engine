import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * `apply:verdicts` gives each draft exactly one verdict, and never judges a
 * sent email.
 *
 * Its comment always said "the most recent unverified draft", and `isNull` was
 * imported for the filter — which was never written, so a verdict could land on
 * an email already sent. And a rerun of the same payload, on 24 Sept, recorded
 * every verify event twice. `pnpm test:integration` proves both against real
 * Postgres; this keeps the guard in the fast gate, which runs on every change.
 */
const SOURCE = readFileSync("scripts/apply-verdicts.ts", "utf8");

describe("apply:verdicts", () => {
  it("only ever judges an unsent draft", () => {
    expect(SOURCE).toMatch(/isNull\(outreach\.sentAt\)/);
  });

  it("skips a draft that already has a verdict newer than itself", () => {
    expect(SOURCE).toMatch(/inArray\(events\.type, \["verify_passed", "verify_failed"\]\)/);
    expect(SOURCE).toMatch(/gt\(events\.createdAt, row\.createdAt\)/);
    const from = SOURCE.indexOf("if (judged)");
    expect(SOURCE.slice(from, from + 200)).toMatch(/continue;/);
  });
});
