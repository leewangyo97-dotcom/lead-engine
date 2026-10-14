import { describe, expect, it } from "vitest";
import {
  guessEmail,
  inferPattern,
  isPersonalEmail,
  isRoleAddress,
  isValidSyntax,
  localPart,
  splitName,
} from "./email-pattern";
import { PEOPLE_WEIGHTS, scorePerson } from "./score";
import { isDecisionMaker, seniorityOf } from "./seniority";

describe("seniorityOf", () => {
  it("puts each buyer in their band", () => {
    expect(seniorityOf("Co-Founder & CEO")).toBe("founder_owner");
    expect(seniorityOf("Owner")).toBe("founder_owner");
    expect(seniorityOf("Principal Dentist")).toBe("founder_owner");
    expect(seniorityOf("Chief Technology Officer")).toBe("c_level");
    expect(seniorityOf("CTO")).toBe("c_level");
    expect(seniorityOf("Managing Director")).toBe("c_level");
    expect(seniorityOf("VP of Engineering")).toBe("vp");
    expect(seniorityOf("Head of Product")).toBe("vp");
    expect(seniorityOf("Director of Marketing")).toBe("director");
  });

  it("leaves the rest out, including senior individual contributors", () => {
    expect(seniorityOf("Principal Engineer")).toBe("other");
    expect(seniorityOf("Receptionist")).toBe("other");
    expect(seniorityOf(null)).toBe("other");
    expect(isDecisionMaker("Office Manager")).toBe(false);
    expect(isDecisionMaker("Founder")).toBe(true);
  });
});

describe("email patterns", () => {
  it("splits names, dropping titles, suffixes and accents", () => {
    expect(splitName("Dr. José María García")).toEqual({ first: "jose", last: "garcia" });
    expect(splitName("John Smith Jr.")).toEqual({ first: "john", last: "smith" });
    expect(splitName("Madonna")).toBeNull();
  });

  it("builds each pattern's local part", () => {
    const n = { first: "jane", last: "doe" };
    expect(localPart(n, "first.last")).toBe("jane.doe");
    expect(localPart(n, "flast")).toBe("jdoe");
    expect(localPart(n, "first")).toBe("jane");
    expect(localPart(n, "f.last")).toBe("j.doe");
    expect(localPart(n, "last.first")).toBe("doe.jane");
  });

  it("infers the pattern most known addresses share, ignoring desks and other domains", () => {
    const known = [
      { name: "Jane Doe", email: "jane.doe@acme.com" },
      { name: "Raj Patel", email: "raj.patel@acme.com" },
      { name: "Tom Lee", email: "tlee@acme.com" },
      { name: "Info Desk", email: "info@acme.com" },
      { name: "Ann Wu", email: "ann.wu@other.com" },
    ];
    expect(inferPattern(known, "acme.com")).toEqual({ pattern: "first.last", matches: 2 });
    expect(inferPattern([{ name: "Info", email: "info@acme.com" }], "acme.com")).toBeNull();
  });

  it("guesses one address, and only when the pattern is known", () => {
    expect(guessEmail("Maria Santos", "Acme.com", "first.last")).toBe("maria.santos@acme.com");
    expect(guessEmail("Maria Santos", "acme.com", null)).toBeNull();
    expect(guessEmail("Cher", "acme.com", "first.last")).toBeNull();
  });

  it("knows a person's own mailbox and a desk address from a business one", () => {
    expect(isPersonalEmail("someone@gmail.com")).toBe(true);
    expect(isPersonalEmail("jane@acme.com")).toBe(false);
    expect(isRoleAddress("info@acme.com")).toBe(true);
    expect(isRoleAddress("jane.doe@acme.com")).toBe(false);
    expect(isValidSyntax("jane.doe@acme.com")).toBe(true);
    expect(isValidSyntax("jane..doe@acme.com")).toBe(false);
    expect(isValidSyntax("not an email")).toBe(false);
  });
});

describe("scorePerson", () => {
  const founder = { seniority: "founder_owner" as const, emailStatus: "verified" as const, phone: "+61290000000" };

  it("rewards a reachable founder at a small company that is hiring developers", () => {
    const { score, reasons } = scorePerson(founder, {
      sizeBand: "11-50",
      industry: "Software",
      signals: { hiringDevelopers: true },
    });
    expect(reasons).toMatchObject({ seniority: 30, companySize: 15, industryFit: 8, hiringDevelopers: 15, emailVerified: 15, phone: 3 });
    expect(score).toBe(86);
  });

  it("gives a guessed email little, since it is never sent", () => {
    const guessed = scorePerson({ ...founder, emailStatus: "guessed", phone: null }, {});
    const verified = scorePerson({ ...founder, phone: null }, {});
    expect(verified.score - guessed.score).toBe(PEOPLE_WEIGHTS.contact.verified - PEOPLE_WEIGHTS.contact.guessed);
  });

  it("stays within 0–100, and takes weights as an argument", () => {
    const all = scorePerson(
      { ...founder, linkedinUrl: "https://linkedin.com/in/x" },
      { sizeBand: "11-50", industry: "SaaS", signals: { hiringDevelopers: true, recentFunding: true, outdatedSite: true, noMobileApp: true } },
    );
    expect(all.score).toBeLessThanOrEqual(100);
    const custom = scorePerson(founder, {}, { ...PEOPLE_WEIGHTS, seniority: { ...PEOPLE_WEIGHTS.seniority, founder_owner: 0 } });
    expect(custom.reasons.seniority).toBe(0);
  });
});
