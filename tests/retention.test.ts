import { describe, expect, it } from "vitest";
import { PRUNE_STATUSES, RETAIN_DAYS } from "../lib/retention";

describe("retention policy", () => {
  it("never prunes a status that carries outcome history", () => {
    // scores, outreach and events cascade from leads, so pruning one of these
    // would delete the evidence the Phase 6 learning loop is built on.
    const mustKeep = [
      "harvested",
      "needs_scoring",
      "scored",
      "needs_draft",
      "drafted",
      "in_gmail",
      "answered",
      "won",
      "lost",
    ];
    for (const status of mustKeep) {
      expect(PRUNE_STATUSES).not.toContain(status);
    }
  });

  it("prunes only dead statuses", () => {
    expect([...PRUNE_STATUSES].sort()).toEqual(["closed", "disqualified", "parked"]);
  });

  it("retains for at least a month", () => {
    expect(RETAIN_DAYS).toBeGreaterThanOrEqual(30);
  });
});
