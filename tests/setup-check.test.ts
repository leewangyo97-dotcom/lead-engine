import { describe, expect, it } from "vitest";
import { report } from "../scripts/setup-check";

describe("pnpm setup:check report", () => {
  it("prints each gap with its fix, and fails only on what is required", () => {
    const { text, failed } = report([
      { ok: true, required: true, what: "Database reachable" },
      { ok: false, what: "Secret SEC_USER_AGENT missing", fix: "gh secret set SEC_USER_AGENT" },
    ]);
    expect(text).toContain("  ok  Database reachable");
    expect(text).toContain("  --  Secret SEC_USER_AGENT missing");
    expect(text).toContain("fix: gh secret set SEC_USER_AGENT");
    expect(text).toContain("1 to do.");
    expect(failed).toBe(false);
  });

  it("fails when something required is missing", () => {
    expect(report([{ ok: false, required: true, what: "Database not reachable", fix: "Check DATABASE_URL" }]).failed).toBe(true);
  });

  it("says so when everything is set up", () => {
    expect(report([{ ok: true, what: "Gmail connected" }]).text).toContain("Everything is set up.");
  });
});
