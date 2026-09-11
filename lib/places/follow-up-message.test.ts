import { describe, expect, it } from "vitest";
import { MAX_STEP } from "../followups";
import { firstMessage } from "./contact";
import { claimsOf } from "./draft-claims";
import { dueAfterDays, followUpMessage, messageFor } from "./follow-up-message";
import { verifyMessage } from "./message-verify";

const vet = { name: "Cebu Vet Clinic", category: "veterinary" };

describe("followUpMessage", () => {
  it("is not the first message again", () => {
    // The whole reason this exists: without it, a prospect on the ladder would
    // have received their opening message word for word a second time.
    const first = firstMessage({ name: vet.name });
    expect(followUpMessage({ ...vet, step: 1 })).not.toBe(first);
    expect(followUpMessage({ ...vet, step: 2 })).not.toBe(first);
  });

  it("refers to the earlier message rather than opening cold", () => {
    expect(followUpMessage({ ...vet, step: 1 })).toMatch(/following up on my message/i);
  });

  it("adds something the first message did not say", () => {
    // Concrete about what the page would contain, which the opener only gestured
    // at with "a simple one-pager".
    expect(followUpMessage({ ...vet, step: 1 })).toMatch(/appointment/);
  });

  it("says the last one is the last one", () => {
    const last = followUpMessage({ ...vet, step: MAX_STEP });
    expect(last).toMatch(/last note from me/i);
    expect(last).toMatch(/won't keep messaging/i);
  });

  it("offers a way out in both", () => {
    expect(followUpMessage({ ...vet, step: 1 })).toMatch(/shall I leave it/i);
    expect(followUpMessage({ ...vet, step: 2 })).toMatch(/no problem at all/i);
  });

  it("describes the page by trade", () => {
    expect(followUpMessage({ name: "X", category: "restaurants", step: 1 })).toMatch(/your menu/);
    expect(followUpMessage({ name: "X", category: "hotels", step: 1 })).toMatch(/your rooms/);
    expect(followUpMessage({ name: "X", category: "salons", step: 1 })).toMatch(/treatments/);
  });

  it("falls back to something true for a trade it does not know", () => {
    const text = followUpMessage({ name: "X", category: "locksmiths", step: 1 });
    expect(text).toMatch(/what you offer/);
  });

  it("claims nothing about their business that could be wrong", () => {
    // The first message carries the observation and the risk of being wrong
    // about it. Repeating that in a follow-up doubles the exposure for nothing.
    for (const step of [1, 2]) {
      const text = followUpMessage({ ...vet, step });
      expect(claimsOf(text)).toEqual([]);
      expect(verifyMessage(text, [])).toEqual([]);
    }
  });

  it("stays short enough to read on a phone", () => {
    for (const step of [1, 2]) {
      expect(followUpMessage({ ...vet, step }).length).toBeLessThan(500);
    }
  });

  it("refuses a step the ladder does not have", () => {
    expect(() => followUpMessage({ ...vet, step: 0 })).toThrow(/ladder runs 1 to/);
    expect(() => followUpMessage({ ...vet, step: MAX_STEP + 1 })).toThrow(/ladder runs 1 to/);
  });
});

describe("dueAfterDays", () => {
  it("mirrors the ladder rather than repeating its numbers", () => {
    expect(dueAfterDays(1)).toBe(4);
    expect(dueAfterDays(2)).toBe(11);
  });

  it("refuses a rung that does not exist", () => {
    expect(() => dueAfterDays(MAX_STEP + 1)).toThrow(/no ladder rung/);
  });
});

describe("messageFor", () => {
  const base = { name: "Cebu Vet Clinic", category: "veterinary" };

  it("lets the opener be generated when there is no accepted draft", () => {
    // undefined means "chooseChannel builds it", which is how the first message
    // has always worked.
    expect(messageFor({ ...base, step: 0 })).toBeUndefined();
  });

  it("prefers an accepted draft for the opener", () => {
    expect(messageFor({ ...base, step: 0, draftBody: "a reviewed message" })).toBe(
      "a reviewed message",
    );
  });

  it("uses the follow-up from step 1 onwards, draft or no draft", () => {
    // The bug this rule fixes: every step used to take the draft or the opener,
    // so day four repeated the opening message to someone who ignored it.
    for (const step of [1, 2]) {
      const text = messageFor({ ...base, step, draftBody: "the opening message" })!;
      expect(text).not.toBe("the opening message");
      expect(text).toMatch(/following up|last note from me/i);
    }
  });

  it("passes the trade through, so the follow-up stays specific", () => {
    expect(messageFor({ name: "X", category: "hotels", step: 1 })).toMatch(/your rooms/);
  });
});

describe("a prospect who already has a website", () => {
  it("offers a comparison rather than a first page", () => {
    // "One page showing your menu" to a restaurant whose site already has a menu
    // reads as not having looked.
    const text = followUpMessage({ name: "X", category: "restaurants", step: 1, hasWebsite: true });
    expect(text).toMatch(/beside what you have now/);
    expect(text).not.toMatch(/^.*one page showing/);
  });

  it("still says what the page would contain", () => {
    expect(followUpMessage({ name: "X", category: "hotels", step: 1, hasWebsite: true })).toMatch(
      /your rooms/,
    );
  });

  it("passes no judgement on the site they have", () => {
    // Nothing here can support an opinion about their design, and the verifier
    // would refuse a claim about it anyway.
    for (const step of [1, 2]) {
      const text = followUpMessage({ name: "X", step, hasWebsite: true });
      expect(text).not.toMatch(/dated|outdated|old|slow|ugly|broken|poor/i);
      expect(verifyMessage(text, [])).toEqual([]);
      expect(claimsOf(text)).toEqual([]);
    }
  });

  it("keeps the no-website wording for everyone else", () => {
    expect(followUpMessage({ name: "X", category: "restaurants", step: 1 })).toMatch(
      /one page showing your menu/,
    );
  });
});

describe("the categories the Austin and Sydney searches produce", () => {
  it("offers a trade a quote form, not a booking slot", () => {
    // A roofer is hired off a quote. The previous default offered them "a button
    // that opens WhatsApp", which was the Cebu assumption reaching Texas.
    const message = followUpMessage({ name: "Alta Roofing, LLC", step: 1, category: "trades" });
    expect(message).toContain("a form that asks for a quote");
    expect(message).toContain("the areas you cover");
    expect(message).not.toMatch(/whatsapp/i);
  });

  it("covers every category the live searches actually use", () => {
    // The map had entries for the Cebu categories only, so ten of the sixteen
    // follow-ups due on 14 September fell through to the default.
    const live = [
      "trades", "contractors", "professionalServices", "medicalSpecialists",
      "clinics", "veterinary", "dentists",
    ];
    for (const category of live) {
      const message = followUpMessage({ name: "Test Co", step: 1, category });
      expect(message, category).not.toContain("what you offer, where you are");
    }
  });

  it("says nothing about which app when the category is unknown", () => {
    const message = followUpMessage({ name: "Test Co", step: 1, category: "somethingNew" });
    expect(message).not.toMatch(/whatsapp/i);
  });

  it("still names WhatsApp for a Cebu restaurant, where it is the right door", () => {
    const message = followUpMessage({ name: "Abaseria Deli & Cafe", step: 1, category: "restaurants" });
    expect(message).toMatch(/whatsapp/i);
  });
});
