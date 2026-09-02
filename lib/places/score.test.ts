import { describe, expect, it } from "vitest";
import { HOT_AT, isScoreProvisional, scoreProspect, WEIGHTS } from "./score";

const bare = { name: "Cebu Vet" };

describe("scoreProspect", () => {
  it("scores an unreachable, unknown prospect at nothing", () => {
    expect(scoreProspect(bare).score).toBe(WEIGHTS.noWebsite);
  });

  it("rates a published WhatsApp number above a mobile above a landline", () => {
    const whatsapp = scoreProspect({ ...bare, whatsappE164: "+639171234567" }).score;
    const mobile = scoreProspect({ ...bare, phoneE164: "+639171234567" }).score;
    const landline = scoreProspect({ ...bare, phoneE164: "+63322382289" }).score;
    expect(whatsapp).toBeGreaterThan(mobile);
    expect(mobile).toBeGreaterThan(landline);
  });

  it("treats having no website as the opening, not as a missing field", () => {
    const none = scoreProspect(bare);
    const has = scoreProspect({ ...bare, website: "https://vet.ph" });
    expect(none.reasons.noWebsite).toBe(WEIGHTS.noWebsite);
    expect(has.reasons.noWebsite).toBeUndefined();
    expect(none.score).toBeGreaterThan(has.score);
  });

  it("only credits site problems that were actually measured", () => {
    // An unread site is unknown, not healthy. Scoring it as though it passed
    // would promote prospects nobody checked.
    const unread = scoreProspect({ ...bare, website: "https://vet.ph" });
    expect(unread.reasons.siteNoHttps).toBeUndefined();
    expect(unread.reasons.siteNoViewport).toBeUndefined();

    const measured = scoreProspect({
      ...bare,
      website: "http://vet.ph",
      siteSignals: { noHttps: true, noViewport: true },
    });
    expect(measured.reasons.siteNoHttps).toBe(WEIGHTS.siteNoHttps);
    expect(measured.reasons.siteNoViewport).toBe(WEIGHTS.siteNoViewport);
  });

  it("ignores site signals when there is no website to have them", () => {
    const out = scoreProspect({ ...bare, siteSignals: { noHttps: true } });
    expect(out.reasons.siteNoHttps).toBeUndefined();
    expect(out.reasons.noWebsite).toBe(WEIGHTS.noWebsite);
  });

  it("reasons sum to the score, so every point is traceable", () => {
    const out = scoreProspect({
      ...bare,
      whatsappE164: "+639171234567",
      email: "hi@vet.ph",
      city: "Cebu City",
      category: "veterinary",
    });
    const sum = Object.values(out.reasons).reduce((a, b) => a + b, 0);
    expect(sum).toBe(out.score);
  });

  it("never exceeds 100, however many things are true", () => {
    const out = scoreProspect({
      ...bare,
      whatsappE164: "+639171234567",
      email: "hi@vet.ph",
      city: "Cebu City",
      category: "veterinary",
      website: "http://vet.ph",
      siteSignals: { noHttps: true, noViewport: true, hasBookingForm: true },
    });
    // Everything true at once comes to 95, so the cap is a guard rather than a
    // reachable value — worth keeping, since a new weight must not break the scale.
    expect(out.score).toBeLessThanOrEqual(100);
    expect(out.score).toBe(95);
  });

  it("calls a reachable prospect with no website hot", () => {
    const out = scoreProspect({
      ...bare,
      whatsappE164: "+639171234567",
      city: "Cebu City",
      category: "veterinary",
    });
    expect(out.score).toBeGreaterThanOrEqual(HOT_AT);
    expect(out.tier).toBe("hot");
  });

  it("calls an unreachable prospect cold whatever else is known", () => {
    // 25 for no website plus city and category would otherwise reach "warm",
    // ranking a business nobody can contact above one that can be messaged.
    const out = scoreProspect({ ...bare, city: "Cebu City", category: "veterinary" });
    expect(out.score).toBe(35);
    expect(out.tier).toBe("cold");
  });

  it("keeps the score visible even when the tier is gated to cold", () => {
    // The number still says how good a prospect they would be if a number
    // turned up, which is exactly what a refresh might find.
    const out = scoreProspect({ ...bare, city: "Cebu City" });
    expect(out.score).toBeGreaterThan(0);
    expect(out.tier).toBe("cold");
  });
});

describe("do-not-contact", () => {
  it("is never hot, however reachable and promising", () => {
    const base = { name: "Cebu Vet", whatsappE164: "+639171234567", city: "Cebu City", category: "veterinary" };
    expect(scoreProspect(base).tier).toBe("hot");
    // Same prospect, after they asked not to be contacted.
    expect(scoreProspect({ ...base, status: "do_not_contact" }).tier).toBe("cold");
  });

  it("keeps the score, which still records what was known about them", () => {
    const out = scoreProspect({
      name: "Cebu Vet",
      whatsappE164: "+639171234567",
      status: "do_not_contact",
    });
    expect(out.score).toBeGreaterThan(0);
  });
});

describe("isScoreProvisional", () => {
  it("flags a prospect whose site has never been read", () => {
    expect(
      isScoreProvisional({ ...bare, website: "https://vet.ph", enrichmentStatus: "pending" }),
    ).toBe(true);
  });

  it("does not flag a prospect with no website — there is nothing left to learn", () => {
    expect(isScoreProvisional({ ...bare, enrichmentStatus: "pending" })).toBe(false);
  });

  it("does not flag a site that was read, even if it yielded nothing", () => {
    expect(
      isScoreProvisional({
        ...bare,
        website: "https://vet.ph",
        enrichmentStatus: "no_contact_found",
      }),
    ).toBe(false);
  });
});
