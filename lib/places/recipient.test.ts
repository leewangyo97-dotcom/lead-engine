import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { firstEmail } from "./email-message";
import { followUpMessage } from "./follow-up-message";
import { addressTo, bestOwner, greetingName, pickRecipient, type Owner } from "./recipient";

const owner = (over: Partial<Owner> = {}): Owner & { score: number | null } => ({
  personId: "p1",
  name: "Jane Smith",
  title: "Owner",
  seniority: "founder_owner",
  email: "jane@baydental.com",
  greeting: "Jane",
  score: 50,
  ...over,
});

describe("greetingName", () => {
  it("greets by first name", () => {
    expect(greetingName("Jane Smith")).toBe("Jane");
    expect(greetingName("Mary-Jane O'Brien")).toBe("Mary-Jane");
    expect(greetingName("Mr. Tom Reyes")).toBe("Tom");
  });

  it("greets a doctor as Dr. Surname, credentials dropped", () => {
    expect(greetingName("Dr. Jane Smith")).toBe("Dr. Smith");
    expect(greetingName("Dr Jane Smith, DDS")).toBe("Dr. Smith");
    expect(greetingName("Dr. Raj Patel DMD")).toBe("Dr. Patel");
  });

  it("keeps surname particles with the surname (verifier, 15 Oct)", () => {
    expect(greetingName("Dr. Maria Dela Cruz")).toBe("Dr. Dela Cruz");
    expect(greetingName("Dr. Maria de la Cruz")).toBe("Dr. de la Cruz");
    expect(greetingName("Dr. Hans van der Berg")).toBe("Dr. van der Berg");
    expect(greetingName("Dr. De Souza")).toBe("Dr. De Souza");
    expect(greetingName("Dr. Maria Delos Santos")).toBe("Dr. Delos Santos");
    expect(greetingName("Dr. Maria De Los Santos")).toBe("Dr. De Los Santos");
    expect(greetingName("Dr. Juan San Pedro")).toBe("Dr. San Pedro");
    expect(greetingName("Dr. Omar Al Hassan")).toBe("Dr. Al Hassan");
    expect(greetingName("Dr. Mary St. John")).toBe("Dr. St. John");
  });

  it("never puts a credential or a shouted word after Dr.", () => {
    // Known credentials are dropped; an unknown one leaves no safe surname.
    expect(greetingName("Dr. Jane Smith DPM")).toBe("Dr. Smith");
    expect(greetingName("Dr. Jane Smith BDSc")).toBe("Dr. Smith");
    expect(greetingName("Dr. Jane Smith MSc")).toBeNull();
    expect(greetingName("Dr. Jane Smith FRCPC")).toBeNull();
    expect(greetingName("Dr. JANE SMITH")).toBeNull();
  });

  it("drops credentials after the name", () => {
    expect(greetingName("Jane Smith, CPA")).toBe("Jane");
  });

  it("tidies a name written in capitals", () => {
    expect(greetingName("JANE SMITH")).toBe("Jane");
  });

  it("gives no greeting when the name is not safe to use", () => {
    expect(greetingName("Jane")).toBeNull(); // one word: could be anything
    expect(greetingName("J. Smith")).toBeNull(); // an initial
    expect(greetingName("jane smith")).toBeNull(); // not written as a name
    expect(greetingName("")).toBeNull();
    expect(greetingName("Dr.")).toBeNull();
  });
});

describe("bestOwner", () => {
  it("prefers someone who can be written to, then seniority", () => {
    const pick = bestOwner([
      owner({ personId: "a", seniority: "founder_owner", email: null }),
      owner({ personId: "b", seniority: "director", email: "b@x.com" }),
    ]);
    expect(pick?.personId).toBe("b");
    expect(
      bestOwner([
        owner({ personId: "a", seniority: "director" }),
        owner({ personId: "b", seniority: "founder_owner" }),
      ])?.personId,
    ).toBe("b");
  });

  it("returns nothing for nobody", () => {
    expect(bestOwner([])).toBeNull();
  });
});

describe("pickRecipient", () => {
  const business = { email: "info@baydental.com", emailConfidence: "text" };

  it("sends a first email to the owner's own verified address", () => {
    const r = pickRecipient({ business, owner: owner(), earlier: null });
    expect(r.email).toBe("jane@baydental.com");
    expect(r.emailConfidence).toBe("mailto");
    expect(r.person?.greeting).toBe("Jane");
  });

  it("writes to the business, greeting the owner, when the owner has no usable address", () => {
    const r = pickRecipient({ business, owner: owner({ email: null }), earlier: null });
    expect(r.email).toBe("info@baydental.com");
    expect(r.emailConfidence).toBe("text");
    expect(r.person?.personId).toBe("p1");
  });

  it("keeps the business address with no owner found", () => {
    const r = pickRecipient({ business, owner: null, earlier: null });
    expect(r).toEqual({ email: "info@baydental.com", emailConfidence: "text", person: null });
  });

  it("sends a follow-up where the first email went, even after an owner is found", () => {
    const r = pickRecipient({
      business,
      owner: owner(),
      earlier: { toAddress: "info@baydental.com", personId: null },
    });
    expect(r.email).toBe("info@baydental.com");
    expect(r.person).toBeNull();
  });

  it("keeps a sequence that started with the owner on the owner", () => {
    const r = pickRecipient({
      business,
      owner: owner(),
      earlier: { toAddress: "jane@baydental.com", personId: "p1" },
    });
    expect(r.email).toBe("jane@baydental.com");
    expect(r.emailConfidence).toBe("mailto");
    expect(r.person?.personId).toBe("p1");
  });

  it("treats rows from before the address was recorded as sent to the business", () => {
    const r = pickRecipient({ business, owner: owner(), earlier: { toAddress: null, personId: null } });
    expect(r.email).toBe("info@baydental.com");
    expect(r.person).toBeNull();
  });
});

describe("addressTo", () => {
  it("swaps the business for the person in each opening the emails use", () => {
    expect(addressTo("Hi Bay Dental,\n\nText", "Bay Dental", "Jane")).toBe("Hi Jane,\n\nText");
    expect(addressTo("Hi Bay Dental — following up", "Bay Dental", "Dr. Smith")).toBe(
      "Hi Dr. Smith — following up",
    );
  });

  it("leaves a different business and other openings alone", () => {
    expect(addressTo("Hi Bay Dental Studio, text", "Bay Dental", "Jane")).toBe("Hi Bay Dental Studio, text");
    expect(addressTo("Hello Bay Dental, text", "Bay Dental", "Jane")).toBe("Hello Bay Dental, text");
  });

  it("changes nothing without a greeting", () => {
    expect(addressTo("Hi Bay Dental, text", "Bay Dental", null)).toBe("Hi Bay Dental, text");
  });

  it("addresses every first email and follow-up the ladder writes", () => {
    const place = { id: "x", name: "Bay Dental", category: "dentists", city: "Austin", siteSignals: null };
    for (const website of [null, "https://baydental.com"]) {
      const { body } = firstEmail({ ...place, website });
      expect(addressTo(body, "Bay Dental", "Jane").startsWith("Hi Jane,")).toBe(true);
    }
    const demo = firstEmail({ ...place, website: null, demoUrl: "https://example.github.io/bay-dental/" });
    expect(addressTo(demo.body, "Bay Dental", "Jane").startsWith("Hi Jane,")).toBe(true);
    for (const step of [1, 2]) {
      const text = followUpMessage({ name: "Bay Dental", step, category: "dentists" });
      expect(addressTo(text, "Bay Dental", "Jane").startsWith("Hi Jane — ")).toBe(true);
    }
  });
});

describe("where the recipient is used", () => {
  const log = readFileSync("lib/places/outreach-log.ts", "utf8");

  it("composes every email through the one rule, and hands back the resolved address", () => {
    const compose = log.slice(log.indexOf("export async function composeContact("));
    expect(compose).toContain("pickRecipient({");
    expect(compose).toContain("addressTo(message, place.name, recipient.person?.greeting)");
    expect(compose).toContain("place: to,");
  });

  it("records where each email went, and a bounce blocks that address", () => {
    expect(log).toContain("to: toAddress ?? place.email");
    expect(readFileSync("lib/places/bounce.ts", "utf8")).toContain("const email = sent ?? place.email;");
  });

  it("refuses an owner's address that is on the do-not-contact list", () => {
    expect(log).toContain("const listed = await addressListed(to.email);");
  });

  it("names no owner on a record with no website, where the email says none was found", () => {
    expect(log).toContain("const owner = place.website ? chosen : null;");
    expect(readFileSync("lib/places/prospect-queries.ts", "utf8")).toContain(
      "owner: r.website ? (owners.get(r.id) ?? null) : null,",
    );
  });

  it("keeps a sequence begun on WhatsApp with the business", () => {
    expect(log).toContain(
      "const started = earlier.get(prospectId) ?? (previous ? { toAddress: null, personId: null } : null);",
    );
    expect(readFileSync("lib/places/prospect-queries.ts", "utf8")).toContain(
      "earlier: earlier.get(r.id) ?? (contacts.has(r.id) ? { toAddress: null, personId: null } : null),",
    );
  });

  it("stops the follow-ups when the person said no on /people", () => {
    expect(log).toContain("const closed = await personClosed(started.personId);");
  });
});
