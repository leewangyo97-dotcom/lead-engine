import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { chooseChannel } from "./contact";
import { publicDomain, publicReason } from "./public-institution";
import { scoreProspect } from "./score";

describe("publicDomain", () => {
  it("knows the public bodies on the list, by their domains", () => {
    for (const [email, domain] of [
      ["angurugu.clinicmgr@nt.gov.au", "nt.gov.au"], // bounced "Suspect Spam", 14 Oct
      ["office@det.nsw.edu.au", "det.nsw.edu.au"], // 2,231 NSW public schools
      ["school@deped.gov.ph", "deped.gov.ph"],
      ["office@dbb.catholic.edu.au", "dbb.catholic.edu.au"],
      ["clinic@health.nsw.gov.au", "health.nsw.gov.au"],
      ["gp@nhs.net", "nhs.net"],
      ["surgery@practice.nhs.uk", "practice.nhs.uk"],
      ["office@central.k12.tx.us", "central.k12.tx.us"],
      ["press@army.mil", "army.mil"],
      ["Info@NT.GOV.AU", "nt.gov.au"],
    ]) {
      expect(publicDomain(email)).toBe(domain);
    }
  });

  it("leaves private businesses alone, however close their names come", () => {
    for (const email of [
      "admin@annandaleeyecare.com.au",
      "owner@gmail.com",
      "hello@governance.com.au",
      "team@edunation.com",
      "info@government-services.org",
      "contact@mygov.co",
    ]) {
      expect(publicDomain(email)).toBeNull();
    }
    expect(publicDomain(null)).toBeNull();
    expect(publicDomain("not an address")).toBeNull();
  });

  it("says why, naming the domain", () => {
    expect(publicReason("nt.gov.au")).toMatch(/^public body \(nt\.gov\.au\)/);
  });
});

const angurugu = {
  name: "Angurugu Health Centre",
  category: "clinics",
  city: null,
  website: null,
  email: "angurugu.clinicmgr@nt.gov.au",
  phoneE164: "+61889876000",
  whatsappE164: null,
};

describe("a public body is not a prospect", () => {
  it("offers no channel, with the reason where the buttons were", () => {
    const plan = chooseChannel(angurugu);
    expect(plan.preferred).toBeNull();
    expect(plan.email).toMatchObject({ available: false, reason: publicReason("nt.gov.au") });
    expect(plan.whatsapp).toMatchObject({ available: false, reason: publicReason("nt.gov.au") });
  });

  it("scores zero and cold, so it never reaches the top of the queue", () => {
    const scored = scoreProspect(angurugu);
    expect(scored.score).toBe(0);
    expect(scored.tier).toBe("cold");
    expect(scored.reasons.publicInstitution).toBeLessThan(0);

    const privateClinic = scoreProspect({ ...angurugu, email: "admin@annandaleeyecare.com.au" });
    expect(privateClinic.score).toBeGreaterThan(0);
    expect(privateClinic.reasons.publicInstitution).toBeUndefined();
  });

  it("is refused where every send passes, and by Enhance", () => {
    const log = readFileSync("lib/places/outreach-log.ts", "utf8");
    const compose = log.slice(log.indexOf("export async function composeContact("));
    expect(compose.indexOf("publicDomain(place.email)")).toBeGreaterThan(-1);
    expect(compose.indexOf("publicDomain(place.email)")).toBeLessThan(compose.indexOf("findSuppression("));
    expect(readFileSync("app/api/prospects/[id]/enhance/route.ts", "utf8")).toContain(
      "publicDomain(place.email)",
    );
  });
});
