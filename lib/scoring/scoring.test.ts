import { describe, expect, it } from "vitest";
import { disqualify, MAX_AGE_DAYS, CONTACT_COOLDOWN_DAYS } from "./disqualify";
import type { DisqualifyInput } from "./disqualify";
import { prescore, NEEDS_DRAFT_THRESHOLD } from "./prescore";
import type { PrescoreInput } from "./prescore";

const NOW = new Date("2026-09-01T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const base: DisqualifyInput = {
  title: "Senior Android Engineer",
  summary: "Kotlin and Jetpack Compose, contract welcome.",
  region: "REMOTE (Worldwide)",
  remoteScope: "worldwide",
  isContract: true,
  stack: ["kotlin"],
  postedAt: daysAgo(3),
};

describe("disqualify", () => {
  it("passes a lead that matches the profile", () => {
    expect(disqualify(base, NOW)).toBeNull();
  });

  it("rejects stacks Joshua has never shipped", () => {
    expect(disqualify({ ...base, summary: "ESP32 firmware in embedded C" }, NOW)).toBe(
      "disqualified_stack",
    );
    expect(disqualify({ ...base, summary: "Solidity smart contract audits" }, NOW)).toBe(
      "disqualified_stack",
    );
  });

  it("rejects onsite only when there is no contract option", () => {
    expect(disqualify({ ...base, remoteScope: "onsite", isContract: false }, NOW)).toBe(
      "onsite_no_contract",
    );
    expect(disqualify({ ...base, remoteScope: "onsite", isContract: true }, NOW)).toBeNull();
  });

  it("rejects language, citizenship and unpaid postings", () => {
    expect(disqualify({ ...base, summary: "Fluent German required" }, NOW)).toBe("language_required");
    expect(disqualify({ ...base, summary: "Must hold a security clearance" }, NOW)).toBe(
      "citizenship_or_clearance",
    );
    expect(disqualify({ ...base, summary: "Equity-only for now" }, NOW)).toBe(
      "unpaid_or_equity_only",
    );
  });

  it("rejects non-engineering roles by title, not by body", () => {
    expect(disqualify({ ...base, title: "Account Executive" }, NOW)).toBe("non_engineering_role");
    // "sales" appearing in the body of an engineering role is not a reason.
    expect(disqualify({ ...base, summary: "You will build our sales dashboard" }, NOW)).toBeNull();
  });

  it("rejects postings older than the cutoff, and keeps ones just inside it", () => {
    expect(disqualify({ ...base, postedAt: daysAgo(MAX_AGE_DAYS + 1) }, NOW)).toBe("stale_posting");
    expect(disqualify({ ...base, postedAt: daysAgo(MAX_AGE_DAYS - 1) }, NOW)).toBeNull();
  });

  it("respects the contact cooldown", () => {
    expect(disqualify({ ...base, lastContactedAt: daysAgo(30) }, NOW)).toBe("recently_contacted");
    expect(
      disqualify({ ...base, lastContactedAt: daysAgo(CONTACT_COOLDOWN_DAYS + 1) }, NOW),
    ).toBeNull();
  });
});

const lead: PrescoreInput = {
  title: "Senior Android Engineer",
  summary: "Kotlin, Jetpack Compose. Remote worldwide. Contract or freelance.",
  region: "REMOTE (Worldwide)",
  remoteScope: "worldwide",
  isContract: true,
  isDirect: true,
  contact: "dave@evanlee.co.uk",
  payMinUsdHr: 80,
  stack: ["kotlin"],
  postedAt: daysAgo(2),
};

describe("prescore", () => {
  it("scores an ideal lead into the live tier", () => {
    const r = prescore(lead, NOW);
    expect(r.parts).toEqual({ timezone: 30, contract: 20, stack: 25, contact: 10, pay: 10, freshness: 5 });
    expect(r.score).toBe(100);
    expect(r.tier).toBe("live");
  });

  it("never exceeds 100 or drops below 0", () => {
    const worst = prescore(
      { ...lead, remoteScope: "onsite", isContract: false, isDirect: false, contact: null, payMinUsdHr: 10, stack: [], title: "Engineer", summary: "", postedAt: daysAgo(200) },
      NOW,
    );
    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(worst.score).toBeLessThanOrEqual(100);
  });

  it("takes the highest stack band, never the sum", () => {
    const both = prescore({ ...lead, summary: "Kotlin and Node.js and Express", stack: ["kotlin", "node"] }, NOW);
    const kotlinOnly = prescore({ ...lead, summary: "Kotlin only", stack: ["kotlin"] }, NOW);
    expect(both.parts.stack).toBe(kotlinOnly.parts.stack);
    expect(both.parts.stack).toBe(25);
  });

  it("scores bare REMOTE below a stated worldwide", () => {
    const bare = prescore({ ...lead, region: "REMOTE", summary: "Kotlin work.", remoteScope: "worldwide" }, NOW);
    expect(bare.parts.timezone).toBe(15);
    expect(prescore(lead, NOW).parts.timezone).toBe(30);
  });

  it("prefers an unstated rate to a stated low one", () => {
    expect(prescore({ ...lead, payMinUsdHr: null }, NOW).parts.pay).toBe(4);
    expect(prescore({ ...lead, payMinUsdHr: 20 }, NOW).parts.pay).toBe(3);
  });

  it("puts a US-only full-time role below the draft threshold", () => {
    const us = prescore(
      { ...lead, remoteScope: "us", region: "REMOTE (US only)", isContract: false, summary: "Kotlin, full-time employees only." },
      NOW,
    );
    expect(us.score).toBeLessThan(NEEDS_DRAFT_THRESHOLD);
  });
});
