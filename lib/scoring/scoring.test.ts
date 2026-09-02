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

  it("rejects a disqualified language named as the role's own language", () => {
    // Both reached stage 2 on the first real batch and cost tokens to score.
    expect(disqualify({ ...base, title: "Backend Systems Engineer (Rust)" }, NOW)).toBe(
      "disqualified_stack",
    );
    expect(disqualify({ ...base, title: "Rust Developer" }, NOW)).toBe("disqualified_stack");
    expect(disqualify({ ...base, title: "Senior Golang Engineer" }, NOW)).toBe("disqualified_stack");
  });

  it("leaves a mixed title to stage 2 rather than hard-rejecting it", () => {
    // "Sr Full-Stack Engineer (Rust + React)" names a language he does work in.
    // A hard disqualifier has to be certain; this one is a judgment call, and
    // stage 2 already scored it 50 and parked it.
    expect(disqualify({ ...base, title: "Sr Full-Stack Engineer (Rust + React)" }, NOW)).toBeNull();
  });

  it("keeps a role that merely lists a disqualified language among others", () => {
    // Rust in a tag list on a TypeScript job is not a reason to reject.
    expect(
      disqualify({ ...base, title: "Senior Software Engineer", summary: "TypeScript, React, some Rust" }, NOW),
    ).toBeNull();
    expect(disqualify({ ...base, title: "Android Engineer", stack: ["kotlin", "rust"] }, NOW)).toBeNull();
  });

  it("rejects a role that requires being somewhere he is not", () => {
    // Employment type never decided whether he could apply — location did. A
    // contract clause does not let someone in Cebu attend a Berlin office.
    for (const isContract of [true, false]) {
      expect(
        disqualify({ ...base, region: "Berlin, Germany", remoteScope: "onsite", isContract }, NOW),
      ).toBe("requires_presence");
      expect(
        disqualify({ ...base, region: "London, UK", remoteScope: "hybrid", isContract }, NOW),
      ).toBe("requires_presence");
    }
  });

  it("keeps full-time remote work, which he is happy to take", () => {
    expect(
      disqualify({ ...base, remoteScope: "remote", isContract: false }, NOW),
    ).toBeNull();
  });

  it("keeps onsite work at home", () => {
    for (const region of ["Cebu City, Philippines", "Makati, Metro Manila"]) {
      expect(disqualify({ ...base, region, remoteScope: "onsite", isContract: false }, NOW)).toBeNull();
    }
  });

  it("rejects remote roles fenced to another country", () => {
    // "Remote (US)" is not remote for someone in Cebu.
    const cases = [
      "Remote (US only)",
      "Fully remote, must reside in the United States",
      "Remote — EU only",
      "You must be authorized to work in the US",
    ];
    for (const summary of cases) {
      // The fixture's region says "Worldwide", which legitimately overrides a
      // lock, so this case has to state a region that does not.
      expect(
        disqualify({ ...base, region: "Remote", remoteScope: "remote", summary }, NOW),
      ).toBe("remote_region_locked");
    }
  });

  it("keeps a role that is region-locked but also open worldwide", () => {
    // Postings often carry both claims; the wider one is what a recruiter
    // honours, and rejecting on the narrower one loses real work.
    expect(
      disqualify(
        {
          ...base,
          region: "Remote",
          remoteScope: "remote",
          summary: "Remote (US) — we also hire worldwide, any timezone",
        },
        NOW,
      ),
    ).toBeNull();
    expect(
      disqualify({ ...base, region: "Remote", remoteScope: "remote", summary: "Remote, APAC or US" }, NOW),
    ).toBeNull();
  });

  it("keeps a founder-titled lead, because those are funding leads to pitch", () => {
    // Every founder-titled row in the database is kind=funding: a funded
    // startup whose founder is the person to email, not a job posting.
    expect(disqualify({ ...base, title: "Founder — humanoid robots" }, NOW)).toBeNull();
  });

  it("treats a bloc-scoped remote role as closed", () => {
    // The harvester marks these "us" or "emea": remote, but only inside a bloc
    // he is not in, which is as closed to him as an office.
    expect(
      disqualify({ ...base, region: "London, UK or NYC", remoteScope: "emea" }, NOW),
    ).toBe("remote_region_locked");
    expect(disqualify({ ...base, region: "Remote (US)", remoteScope: "us" }, NOW)).toBe(
      "remote_region_locked",
    );
  });

  it("keeps a bloc-scoped role that also hires more widely", () => {
    expect(
      disqualify(
        { ...base, region: "REMOTE (US + 18 countries)", remoteScope: "us" },
        NOW,
      ),
    ).toBeNull();
    expect(
      disqualify({ ...base, region: "Remote EMEA, or anywhere", remoteScope: "emea" }, NOW),
    ).toBeNull();
  });

  it("keeps a posting whose country list is longer than the one it names", () => {
    // "Remote (US + 18 countries)" may well include this one. A hard reject has
    // to be certain, so ambiguity goes to the judgement stage instead.
    for (const region of ["REMOTE (US + 18 countries)", "Remote (US, UK + 12 more countries)"]) {
      expect(disqualify({ ...base, region, remoteScope: "remote" }, NOW)).toBeNull();
    }
  });

  it("does not reject a plain remote posting that merely mentions a US office", () => {
    expect(
      disqualify(
        { ...base, region: "Remote", remoteScope: "remote", summary: "Our office is in Austin, Texas" },
        NOW,
      ),
    ).toBeNull();
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
    // Reached stage 2 on the first real run because `growth` and `partnerships`
    // were missing from the list.
    expect(disqualify({ ...base, title: "Founding Growth & Partnerships Lead" }, NOW)).toBe(
      "non_engineering_role",
    );
    expect(disqualify({ ...base, title: "Head of Business Development" }, NOW)).toBe(
      "non_engineering_role",
    );
    // Reached the inbox at 67 on a real harvest: remote, contract, $96-118/hr,
    // and not engineering work. Attractive terms are exactly why this needs a
    // hard reject rather than a low score.
    expect(disqualify({ ...base, title: "Senior Product Manager" }, NOW)).toBe(
      "non_engineering_role",
    );
    expect(disqualify({ ...base, title: "Technical Program Manager" }, NOW)).toBe(
      "non_engineering_role",
    );
    expect(disqualify({ ...base, title: "Scrum Master" }, NOW)).toBe("non_engineering_role");
    // "sales" appearing in the body of an engineering role is not a reason.
    expect(disqualify({ ...base, summary: "You will build our sales dashboard" }, NOW)).toBeNull();
  });

  it("keeps engineering titles that contain a rejected word", () => {
    // The list is broad, so an explicit engineering signal has to win outright.
    expect(disqualify({ ...base, title: "Growth Engineer" }, NOW)).toBeNull();
    expect(disqualify({ ...base, title: "Marketing Platform Developer" }, NOW)).toBeNull();
    expect(disqualify({ ...base, title: "Partnerships Integrations Engineer" }, NOW)).toBeNull();
    // An engineering title wins even next to a rejected word.
    expect(disqualify({ ...base, title: "Engineering Manager, Mobile" }, NOW)).toBeNull();
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

describe("founder leads (kind = funding)", () => {
  const founder: PrescoreInput = {
    kind: "funding",
    title: "Founder — AI that knows your company",
    summary: "We are building agent tooling in TypeScript and React.",
    region: null,
    remoteScope: null,
    isContract: false,
    isDirect: true,
    contact: "kushagra@almanac.com",
    payMinUsdHr: null,
    stack: ["typescript", "react"],
    triggerEvent: "launched on HN 2d ago, YC S26",
    postedAt: daysAgo(2),
  };

  it("does not penalise a founder for the region and terms a launch post never states", () => {
    const r = prescore(founder, NOW);
    // Running this through the job weights would score it near zero for things
    // the founder has not been asked yet.
    expect(r.parts.timezone).toBe(0);
    expect(r.parts.contract).toBe(0);
    expect(r.score).toBeGreaterThanOrEqual(75);
    expect(r.tier).toBe("live");
  });

  it("weights the trigger heavily, and decays it", () => {
    expect(prescore({ ...founder, postedAt: daysAgo(2) }, NOW).parts.freshness).toBe(30);
    expect(prescore({ ...founder, postedAt: daysAgo(14) }, NOW).parts.freshness).toBe(18);
    expect(prescore({ ...founder, postedAt: daysAgo(30) }, NOW).parts.freshness).toBe(6);
    expect(prescore({ ...founder, postedAt: daysAgo(60) }, NOW).parts.freshness).toBe(0);
  });

  it("drops a founder with no contact below the draft threshold", () => {
    // Without an inbox there is nowhere for the email to go.
    const noContact = prescore({ ...founder, contact: null, isDirect: false }, NOW);
    expect(noContact.score).toBeLessThan(NEEDS_DRAFT_THRESHOLD);
  });

  it("keeps a fading launch below the draft threshold", () => {
    // A month-old launch still has a founder inbox and a stack match, so it is
    // not worthless — but "why now" has gone, and that is 30 of the 100 points.
    const fading = prescore({ ...founder, postedAt: daysAgo(30) }, NOW);
    expect(fading.score).toBeLessThan(NEEDS_DRAFT_THRESHOLD);
  });

  it("relies on the age disqualifier, not the score, for a truly stale launch", () => {
    // A 60-day-old post never reaches scoring at all, so the tier it would
    // receive is moot — this is the check that actually protects against it.
    expect(
      disqualify({ ...base, title: "Founder — something", postedAt: daysAgo(60) }, NOW),
    ).toBe("stale_posting");
  });
});
