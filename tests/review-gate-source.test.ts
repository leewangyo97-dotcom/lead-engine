import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The weekly review has to say which condition is actually stopping it.
 *
 * One static sentence was printed whatever the reason, and it aged into a lie:
 * the moment sends passed the threshold it still read "it needs 20 logged sends
 * — currently 23", blaming a counting problem that had already been solved. The
 * real blocker was that nothing had replied.
 */
const SOURCE = readFileSync("app/review/page.tsx", "utf8");

describe("the no-suggestion explanation", () => {
  it("branches on the send count and on whether anything replied", () => {
    expect(SOURCE).toMatch(/rollup\.totalSends < MIN_TOTAL_FOR_SUGGESTION/);
    expect(SOURCE).toMatch(/rollup\.totalReplies === 0/);
  });

  it("does not blame the send count once there are enough sends", () => {
    // The zero-replies branch must not repeat the "needs N logged sends" line.
    const from = SOURCE.indexOf("rollup.totalReplies === 0");
    const branch = SOURCE.slice(from, from + 500);
    expect(branch).not.toMatch(/needs \{MIN_TOTAL_FOR_SUGGESTION\}/);
    expect(branch).toMatch(/not for want of sends/);
  });
});
