import { describe, expect, it } from "vitest";
import { buildEnhancePrompt, buildSignals, signalKeys, MAX_MESSAGE_CHARS } from "./enhance";
import { EnhanceBatch } from "../model/schemas";

const base = {
  id: "p1",
  name: "Cebu Vet",
  city: "Cebu City",
  category: "veterinary",
  email: null,
  phoneE164: null,
  whatsappE164: null,
  website: null,
};

describe("buildSignals", () => {
  it("reports the absence of a website as a fact", () => {
    expect(buildSignals(base).map((s) => s.key)).toContain("no_website");
  });

  it("does not report no_website when there is one", () => {
    const keys = buildSignals({ ...base, website: "https://vet.ph" }).map((s) => s.key);
    expect(keys).toContain("website");
    expect(keys).not.toContain("no_website");
  });

  it("notices plain http, which is checkable", () => {
    expect(buildSignals({ ...base, website: "http://vet.ph" }).map((s) => s.key)).toContain(
      "no_https",
    );
    expect(buildSignals({ ...base, website: "https://vet.ph" }).map((s) => s.key)).not.toContain(
      "no_https",
    );
  });

  it("believes what was measured over the stored URL", () => {
    // A real case: OpenStreetMap held http://www.cebudentist.weebly.com, the
    // site redirects to https, and a message telling the owner their site is
    // insecure would be disproved by the one person reading it.
    const redirects = buildSignals({
      ...base,
      website: "http://vet.ph",
      siteSignals: { noHttps: false, noViewport: true },
    }).map((s) => s.key);

    expect(redirects).not.toContain("no_https");
    expect(redirects).toContain("no_viewport");
  });

  it("still flags a site measured as insecure", () => {
    const keys = buildSignals({
      ...base,
      website: "http://vet.ph",
      siteSignals: { noHttps: true },
    }).map((s) => s.key);
    expect(keys).toContain("no_https");
  });

  it("distinguishes a published WhatsApp number from a mobile from a landline", () => {
    const whatsapp = buildSignals({ ...base, whatsappE164: "+639171234567" }).map((s) => s.key);
    const mobile = buildSignals({ ...base, phoneE164: "+639171234567" }).map((s) => s.key);
    const landline = buildSignals({ ...base, phoneE164: "+63322382289" }).map((s) => s.key);

    expect(whatsapp).toContain("whatsapp_published");
    expect(mobile).toContain("mobile");
    expect(landline).toContain("landline");
    expect(landline).not.toContain("mobile");
  });

  it("says nothing about a site whose contact page was never read", () => {
    // "no contact details on their site" is only true once we looked.
    expect(buildSignals(base).map((s) => s.key)).not.toContain("site_no_contact");
    expect(
      buildSignals({ ...base, enrichmentStatus: "no_contact_found" }).map((s) => s.key),
    ).toContain("site_no_contact");
  });
});

describe("buildEnhancePrompt", () => {
  const prompt = buildEnhancePrompt([base]);

  it("carries the prospect id, so the answer can be matched back", () => {
    expect(prompt).toContain("prospectId: p1");
  });

  it("shows the message being replaced", () => {
    expect(prompt).toContain("Current message:");
    expect(prompt).toContain("Cebu Vet");
  });

  it("forbids inventing facts, in the prompt itself", () => {
    expect(prompt).toMatch(/Do not invent/);
    expect(prompt).toContain(`Under ${MAX_MESSAGE_CHARS} characters`);
  });

  it("asks for JSON with the keys the schema requires", () => {
    for (const key of ["prospectId", "message", "angle", "usedSignals"]) {
      expect(prompt).toContain(key);
    }
  });

  it("handles a prospect with nothing but a name", () => {
    const bare = buildEnhancePrompt([{ id: "p2", name: "Unknown Clinic" }]);
    expect(bare).toContain("Unknown Clinic");
    expect(bare).toContain("No website in the record");
  });
});

describe("EnhanceBatch", () => {
  const valid = {
    enhanced: [
      { prospectId: "p1", message: "Hi", angle: "no website", usedSignals: ["no_website"] },
    ],
  };

  it("accepts a well-formed batch", () => {
    expect(EnhanceBatch.safeParse(valid).success).toBe(true);
  });

  it("rejects a message that names no signals", () => {
    // Without this, a message with no grounding is indistinguishable from one
    // that leaned on a real fact.
    const bad = { enhanced: [{ ...valid.enhanced[0], usedSignals: [] }] };
    expect(EnhanceBatch.safeParse(bad).success).toBe(false);
  });

  it("rejects a message too long to be read on a phone", () => {
    const bad = { enhanced: [{ ...valid.enhanced[0], message: "x".repeat(501) }] };
    expect(EnhanceBatch.safeParse(bad).success).toBe(false);
  });

  it("rejects an empty batch rather than treating it as success", () => {
    expect(EnhanceBatch.safeParse({ enhanced: [] }).success).toBe(false);
  });
});

describe("signalKeys", () => {
  it("returns exactly the keys a message is allowed to claim", () => {
    const keys = signalKeys({ ...base, website: "http://vet.ph" });
    expect(new Set(keys)).toEqual(new Set(["category", "city", "website", "no_https"]));
  });
});

describe("a business that emails from its own domain", () => {
  const leura = {
    id: "x",
    name: "Leura Wellness",
    category: "clinics",
    website: null,
    email: "hello@leurawellness.com.au",
  };

  it("does not offer no_website, so the claim cannot be written", () => {
    // verifyMessage requires no_website for any "you don't have a website"
    // phrasing, so withholding the signal makes the false claim unshippable
    // rather than merely discouraged.
    const keys = buildSignals(leura).map((s) => s.key);
    expect(keys).not.toContain("no_website");
    expect(keys).toContain("email_domain");
  });

  it("names the domain to check", () => {
    const fact = buildSignals(leura).find((s) => s.key === "email_domain")!.fact;
    expect(fact).toContain("leurawellness.com.au");
    expect(fact).toMatch(/check it/i);
  });

  it("still says no_website when the email is a free provider", () => {
    const keys = buildSignals({ ...leura, email: "leurawellness@gmail.com" }).map((s) => s.key);
    expect(keys).toContain("no_website");
    expect(keys).not.toContain("email_domain");
  });

  it("still says no_website when the domain belongs to an institution", () => {
    const school = { ...leura, name: "Tangke Elementary School", email: "137117@deped.gov.ph" };
    expect(buildSignals(school).map((s) => s.key)).toContain("no_website");
  });
});

describe("page weight, when it has actually been measured", () => {
  const lighthouse = {
    url: "https://theroofingguy.co/",
    totalBytes: 10_726_400,
    totalBytesLabel: "Total size was 10,475 KiB",
    unsizedImages: 1,
    contrastFailures: 1,
    namelessLinks: 1,
    unminifiedCssBytes: 3121,
    unusedJsBytes: 24762,
    measuredAt: "2026-09-11T04:00:00.000Z",
  };
  const roofer = { ...base, website: "https://theroofingguy.co/", siteSignals: { lighthouse } };

  it("offers a heavy page as a signal, with the measured wording", () => {
    const signal = buildSignals(roofer).find((s) => s.key === "page_weight");
    expect(signal).toBeDefined();
    expect(signal!.fact).toContain("10,475 KiB");
    // Dated, because a site can be rebuilt the week after it was measured.
    expect(signal!.fact).toContain("2026-09-11");
  });

  it("says nothing about an ordinary page", () => {
    const light = { ...roofer, siteSignals: { lighthouse: { ...lighthouse, totalBytes: 400_000 } } };
    expect(buildSignals(light).map((s) => s.key)).not.toContain("page_weight");
  });

  it("drops a reading taken on a site the record no longer points at", () => {
    // Re-enrichment carries the block across so a 47-second measurement is not
    // lost, which means a moved site would otherwise be described by the old
    // server's numbers.
    const moved = { ...roofer, website: "https://theroofingguy.com/" };
    expect(buildSignals(moved).map((s) => s.key)).not.toContain("page_weight");
  });

  it("says nothing when nobody has run the measurement", () => {
    const unmeasured = {
      ...base,
      website: "https://theroofingguy.co/",
      siteSignals: { noHttps: false, noViewport: false, hasBookingForm: true },
    };
    expect(buildSignals(unmeasured).map((s) => s.key)).not.toContain("page_weight");
  });

  it("never offers the performance score, whatever is stored", () => {
    const withScore = { ...roofer, siteSignals: { lighthouse: { ...lighthouse, score: 61 } } };
    expect(JSON.stringify(buildSignals(withScore))).not.toContain("61");
  });
});
