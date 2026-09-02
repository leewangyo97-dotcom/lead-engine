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
