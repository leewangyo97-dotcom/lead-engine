import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyGuardrails, mergeFindings } from "./merge";
import { emptyFindings, type Findings } from "./providers/types";
import { PEOPLE_RETAIN_DAYS } from "../retention";

const fact = (field: string, value: string, sourceType: "website" | "email_pattern" = "website") => ({
  field,
  value,
  sourceUrl: sourceType === "website" ? "https://acme.com/team" : null,
  sourceType,
});

const with_ = (people: Findings["people"], signals: Record<string, unknown> = {}): Findings => ({
  people,
  company: { signals, facts: [] },
});

describe("mergeFindings", () => {
  it("makes one person of the same name, keeping the published address over a guess", () => {
    const site = with_([{ name: "Jane Doe", title: "CEO", email: "jane@acme.com", emailStatus: "verified", facts: [fact("email", "jane@acme.com")] }]);
    const guess = with_([{ name: "jane doe", email: "jane.doe@acme.com", emailStatus: "guessed", facts: [fact("email", "jane.doe@acme.com", "email_pattern")] }]);
    const merged = mergeFindings(site, guess);
    expect(merged.people).toHaveLength(1);
    expect(merged.people[0]).toMatchObject({ email: "jane@acme.com", emailStatus: "verified", title: "CEO" });
    // Both facts are kept: the source of every field survives the merge.
    expect(merged.people[0].facts.map((f) => f.sourceType)).toEqual(["website", "email_pattern"]);
  });

  it("lets a signal any source saw stand", () => {
    const merged = mergeFindings(with_([], { hiringDevelopers: false }), with_([], { hiringDevelopers: true, recentFunding: true }));
    expect(merged.company.signals).toEqual({ hiringDevelopers: true, recentFunding: true });
  });
});

describe("applyGuardrails", () => {
  const findings = (): Findings => ({
    people: [
      { name: "Jane Doe", title: "Founder", email: "jane@acme.com", emailStatus: "verified", facts: [fact("email", "jane@acme.com")] },
      { name: "Raj Patel", title: "CTO", email: "raj@gmail.com", emailStatus: "verified", facts: [fact("email", "raj@gmail.com")] },
      { name: "Tom Lee", title: "Receptionist", facts: [] },
    ],
    company: { signals: {}, facts: [fact("email", "info@acme.com"), fact("email", "sales@blocked.com")] },
  });

  it("keeps decision-makers only, and no personal mailbox", () => {
    const out = applyGuardrails(findings(), { emails: new Set(), domains: new Set() });
    expect(out.people.map((p) => p.name)).toEqual(["Jane Doe", "Raj Patel"]);
    const raj = out.people.find((p) => p.name === "Raj Patel")!;
    expect(raj.email).toBeUndefined();
    expect(raj.facts.some((f) => f.field === "email")).toBe(false);
  });

  it("drops anything on the do-not-contact list, by address or by domain", () => {
    const out = applyGuardrails(findings(), { emails: new Set(["jane@acme.com"]), domains: new Set(["blocked.com"]) });
    expect(out.people.find((p) => p.name === "Jane Doe")!.email).toBeUndefined();
    expect(out.company.facts.map((f) => f.value)).toEqual(["info@acme.com"]);
  });
});

describe("retention of decision-makers", () => {
  it("deletes only people never contacted, after a year", () => {
    expect(PEOPLE_RETAIN_DAYS).toBe(365);
    const script = readFileSync("scripts/retention.ts", "utf8");
    expect(script).toContain('and(eq(people.status, "new"), lt(people.createdAt, peopleCutoff))');
  });
});

it("starts empty", () => {
  expect(emptyFindings()).toEqual({ people: [], company: { signals: {}, facts: [] } });
});
