import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractClaims, verifyClaims } from "./profile-claims";

const PROFILE = readFileSync("memory/PROFILE.md", "utf8");

describe("extractClaims", () => {
  it("picks up percentages, thousands and spans of years", () => {
    const claims = extractClaims("Cut crashes 35%, fixed 3,000+ defects over 7 years.");
    expect(claims).toContain("35%");
    expect(claims).toContain("3,000");
    expect(claims.some((c) => /7\s*years/.test(c))).toBe(true);
  });

  it("ignores calendar years and small numbers", () => {
    // "Since 2022" and "one of 3 apps" are not claims about achievement, and
    // flagging them would teach the reader to ignore this check.
    expect(extractClaims("Worked there since 2022 on 3 apps.")).toEqual([]);
  });
});

describe("verifyClaims against the real PROFILE.md", () => {
  it("passes the drafts that were actually written", () => {
    const jawa =
      "seven years, Kotlin, on consumer apps. On a consumer platform I led end to end for four years, I cut the crash rate by 35% and closed over 3,000 crash, stability and data-binding defects.";
    expect(verifyClaims(jawa, PROFILE)).toEqual([]);

    const atria =
      "I automated releases with Fastlane on GitHub Actions so 30 signed release variants build in about five minutes.";
    expect(verifyClaims(atria, PROFILE)).toEqual([]);
  });

  it("catches an invented metric", () => {
    // The most damaging thing an outreach email can contain, and the easiest
    // thing for a writer to reach for.
    const violations = verifyClaims("I cut their page load times by 60%.", PROFILE);
    expect(violations).toHaveLength(1);
    expect(violations[0].quote).toBe("60%");
  });

  it("catches an inflated version of a real number", () => {
    // 35% is real; 45% is the same sentence with a better-sounding figure.
    expect(verifyClaims("cut the crash rate by 45%", PROFILE)).toHaveLength(1);
    expect(verifyClaims("resolved 30,000 defects", PROFILE)).toHaveLength(1);
  });

  it("accepts a figure written in a different form", () => {
    // "3,000+" in a draft against "3,000" in the profile is the same claim.
    expect(verifyClaims("over 3,000+ defects", PROFILE)).toEqual([]);
  });

  it("says nothing about a draft that quotes no figures", () => {
    expect(verifyClaims("I build mobile apps and web front ends.", PROFILE)).toEqual([]);
  });
});
