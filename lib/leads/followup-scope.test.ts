import { describe, expect, it } from "vitest";
import { forLeadDrafting, type FollowupRow } from "./followup-queries";

const row = (kind: "lead" | "prospect", id: string): FollowupRow => ({
  kind,
  leadId: id,
  company: id,
  title: "t",
  contact: null,
  nextStep: 1,
  lastSentAt: new Date("2026-09-09T11:31:00Z"),
  previousSubject: "s",
  previousAngle: null,
  daysSince: 4,
});

describe("forLeadDrafting", () => {
  it("keeps leads and drops prospects", () => {
    // The real shape of 13 September: 18 due, 16 of them prospects.
    const due = [
      row("lead", "a"),
      ...Array.from({ length: 16 }, (_, i) => row("prospect", `p${i}`)),
      row("lead", "b"),
    ];
    const out = forLeadDrafting(due);
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.kind === "lead")).toBe(true);
  });

  it("is empty rather than throwing when only prospects are due", () => {
    expect(forLeadDrafting([row("prospect", "p")])).toEqual([]);
  });

  it("is empty for an empty list", () => {
    expect(forLeadDrafting([])).toEqual([]);
  });

  it("keeps the row untouched, so the payload shape does not change", () => {
    const lead = row("lead", "a");
    expect(forLeadDrafting([lead])[0]).toBe(lead);
  });
});
