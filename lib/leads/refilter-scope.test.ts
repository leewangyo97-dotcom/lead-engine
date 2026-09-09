import { describe, expect, it } from "vitest";
import { ALL_STATUSES, PROTECTED, REJUDGEABLE } from "./refilter-scope";

describe("refilter scope", () => {
  it("accounts for every status the enum allows", () => {
    // A status added to the schema and forgotten here is the failure mode: it
    // falls into neither list, and the next person assumes it is safe to
    // re-judge. "harvested" is the one deliberate exception — it has not been
    // judged yet, so there is nothing to protect or redo.
    const covered = new Set<string>([...PROTECTED, ...REJUDGEABLE, "harvested"]);
    const missing = ALL_STATUSES.filter((s) => !covered.has(s));
    expect(missing).toEqual([]);
  });

  it("keeps the two lists disjoint", () => {
    const both = PROTECTED.filter((s) => (REJUDGEABLE as readonly string[]).includes(s));
    expect(both).toEqual([]);
  });

  it("protects every status that implies a message went out", () => {
    // The whole point: anything at or past a draft is off limits.
    for (const status of ["drafted", "in_gmail", "sent", "answered", "won", "lost"]) {
      expect(PROTECTED).toContain(status);
    }
  });
});
