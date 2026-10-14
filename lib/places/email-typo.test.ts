import { describe, expect, it } from "vitest";
import { chooseChannel } from "./contact";
import { firstEmail, possessive } from "./email-message";
import { mistypedEmail, mistypedReason } from "./email-typo";
import { scoreProspect } from "./score";

describe("mistypedEmail", () => {
  it("catches an ending that does not exist, with what was probably meant", () => {
    // We Love Trees, 15 Oct: from the map listing.
    expect(mistypedEmail("info@welovetreestx.xom")).toEqual({
      domain: "welovetreestx.xom",
      suggestion: "welovetreestx.com",
    });
    expect(mistypedEmail("hello@bakery.comau")).toEqual({ domain: "bakery.comau", suggestion: null });
  });

  it("catches known slips on free-mail domains", () => {
    expect(mistypedEmail("jt.dental@gmial.com")?.suggestion).toBe("gmail.com");
    expect(mistypedEmail("Owner@GMAIL.CO")?.suggestion).toBe("gmail.com");
  });

  it("passes real endings, country codes and new ones alike", () => {
    for (const ok of [
      "info@bay.com.au",
      "x@shop.co",
      "x@cafe.ph",
      "a@smile.dental",
      "a@clinic.health",
      "A@Example.COM",
      "a@example.com.",
      "a@xn--80ak6aa92e.xn--p1ai",
    ]) {
      expect(mistypedEmail(ok), ok).toBeNull();
    }
  });

  it("leaves addresses with no domain to the checks that own them", () => {
    expect(mistypedEmail(null)).toBeNull();
    expect(mistypedEmail("nodomain")).toBeNull();
    expect(mistypedEmail("a@localhost")).toBeNull();
  });

  it("says why, and the likely fix, in the reason", () => {
    expect(mistypedReason({ domain: "x.xom", suggestion: "x.com" })).toBe(
      "the address looks mistyped (x.xom, probably x.com), so it would bounce",
    );
  });
});

describe("a mistyped address", () => {
  const place = {
    name: "We Love Trees",
    category: "trades",
    city: "Austin",
    website: "https://welovetreestx.com",
    email: "info@welovetreestx.xom",
    emailConfidence: null,
    phoneE164: null,
    whatsappE164: null,
    countryCode: "US",
    status: "new",
  };

  it("is not offered as an email channel", () => {
    const plan = chooseChannel(place);
    expect(plan.email.available).toBe(false);
    expect(plan.email.reason).toContain("probably welovetreestx.com");
  });

  it("scores as no email at all", () => {
    const typo = scoreProspect({ ...place, siteSignals: null });
    const fixed = scoreProspect({ ...place, email: "info@welovetreestx.com", siteSignals: null });
    expect(typo.reasons.email ?? typo.reasons.emailUnconfirmed).toBeUndefined();
    expect(fixed.score).toBeGreaterThan(typo.score);
  });
});

describe("possessive", () => {
  it("takes the apostrophe alone after a final s", () => {
    expect(possessive("We Love Trees")).toBe("We Love Trees'");
    expect(possessive("SMILES")).toBe("SMILES'");
    expect(possessive("Bay Dental")).toBe("Bay Dental's");
    expect(possessive("Joe's Pizza ")).toBe("Joe's Pizza's");
    // Already possessive (verifier, 15 Oct): "Joe's website", not "Joe's' website".
    expect(possessive("Joe's")).toBe("Joe's");
    expect(possessive("Mario’s")).toBe("Mario’s");
  });

  it("is what the website subject lines use", () => {
    const subjects = ["a1", "b2", "c3", "d4"].map(
      (id) =>
        firstEmail({ id, name: "We Love Trees", category: "trades", city: null, website: "https://x.com", siteSignals: null })
          .subject,
    );
    for (const s of subjects) {
      expect(s).toContain("We Love Trees' website");
      expect(s).not.toContain("Trees's");
    }
  });
});
