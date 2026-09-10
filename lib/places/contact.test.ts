import { describe, expect, it } from "vitest";
import { chooseChannel, firstMessage } from "./contact";
import { isSharedHost } from "./outreach-log";

const vet = {
  name: "Cebu Vet",
  city: "Cebu City",
  email: null,
  phoneE164: null,
  whatsappE164: null,
  website: null,
};

describe("chooseChannel", () => {
  it("prefers WhatsApp when a mobile number exists", () => {
    const plan = chooseChannel({ ...vet, phoneE164: "+639171234567", email: "hi@vet.ph" });
    expect(plan.preferred).toBe("whatsapp");
    expect(plan.whatsapp.href).toContain("https://wa.me/639171234567");
  });

  it("prefers a confirmed WhatsApp number over the general phone", () => {
    const plan = chooseChannel({
      ...vet,
      phoneE164: "+639170000000",
      whatsappE164: "+639171234567",
    });
    expect(plan.whatsapp.href).toContain("639171234567");
  });

  it("trusts a published WhatsApp number even on a landline range", () => {
    // Dresden Vision in Sydney advertises +61 2 5300 3003, which libphonenumber
    // calls a fixed line. WhatsApp Business accepts landlines, so refusing it
    // disabled the button on a number its owner asks to be contacted on.
    const plan = chooseChannel({ ...vet, whatsappE164: "+61253003003" });
    expect(plan.whatsapp.available).toBe(true);
    expect(plan.whatsapp.confidence).toBe("confirmed");
    expect(plan.preferred).toBe("whatsapp");
  });

  it("says a published WhatsApp number is confirmed", () => {
    // They put a wa.me link on their own site: that is them telling us.
    const plan = chooseChannel({ ...vet, whatsappE164: "+639171234567" });
    expect(plan.whatsapp.confidence).toBe("confirmed");
  });

  it("says a plain mobile number is only likely", () => {
    // Accurate in the Philippines, a coin toss in the US where mobile and
    // landline share ranges. Claiming more than that would be a guess dressed
    // as a fact.
    const plan = chooseChannel({ ...vet, phoneE164: "+639171234567" });
    expect(plan.whatsapp.confidence).toBe("likely");
  });

  it("claims no confidence at all when WhatsApp is unavailable", () => {
    expect(chooseChannel({ ...vet, phoneE164: "+63322382289" }).whatsapp.confidence).toBeUndefined();
    expect(chooseChannel(vet).whatsapp.confidence).toBeUndefined();
  });

  it("falls back to email when the number is a landline", () => {
    const plan = chooseChannel({ ...vet, phoneE164: "+63322382289", email: "hi@vet.ph" });
    expect(plan.preferred).toBe("email");
    expect(plan.whatsapp.available).toBe(false);
    // The reason has to be visible before the click: wa.me accepts a landline
    // and fails only once the chat is open.
    expect(plan.whatsapp.reason).toMatch(/landline/);
    expect(plan.whatsapp.reason).toMatch(/publish no WhatsApp/);
  });

  it("says there is no phone rather than offering a broken link", () => {
    const plan = chooseChannel(vet);
    expect(plan.preferred).toBeNull();
    expect(plan.whatsapp.reason).toBe("no phone number");
    expect(plan.email.reason).toBe("no email address");
    expect(plan.whatsapp.href).toBeUndefined();
  });

  it("puts the message into both links", () => {
    const plan = chooseChannel({ ...vet, phoneE164: "+639171234567", email: "hi@vet.ph" });
    const encoded = encodeURIComponent(plan.message.slice(0, 20));
    expect(plan.whatsapp.href).toContain(encoded);
    expect(plan.email.href).toContain(encoded);
  });

  it("strips punctuation from the number, as wa.me requires digits", () => {
    const plan = chooseChannel({ ...vet, phoneE164: "+63 917 123 4567" });
    expect(plan.whatsapp.href).toContain("wa.me/639171234567");
  });

  it("uses the caller's message when one is given", () => {
    const plan = chooseChannel({ ...vet, phoneE164: "+639171234567" }, "Custom text");
    expect(plan.message).toBe("Custom text");
    expect(plan.whatsapp.href).toContain(encodeURIComponent("Custom text"));
  });
});

describe("firstMessage", () => {
  it("names the business and asks one answerable question", () => {
    const text = firstMessage({ ...vet });
    expect(text).toContain("Cebu Vet");
    expect(text.split("?").length - 1).toBe(1);
  });

  it("reports the search rather than asserting the absence", () => {
    // "You don't have a website" is a claim about their business and the record
    // is often wrong about it; "I couldn't find one" is a fact about the search,
    // and it leaves them room to correct it rather than a reason to stop reading.
    const text = firstMessage({ ...vet });
    expect(text).toMatch(/couldn't find a website/);
    expect(text).not.toMatch(/don'?t have a website/);
    expect(text).toMatch(/if you have one and i missed it/i);
  });

  it("only mentions the missing website when the record says so", () => {
    // A business owner knows whether they have a website. Opening with a wrong
    // claim about it ends the conversation.
    expect(firstMessage({ ...vet })).toMatch(/couldn't find a website/);
    expect(firstMessage({ ...vet, website: "https://vet.ph" })).not.toMatch(
      /couldn't find a website/,
    );
  });

  it("mentions their city when known, and reads correctly without one", () => {
    expect(firstMessage({ ...vet })).toContain("Cebu City business");
    expect(firstMessage({ ...vet, city: null })).toContain("a business like yours");
  });

  it("does not claim to have looked at a site it may never have fetched", () => {
    const text = firstMessage({ ...vet, website: "https://vet.ph" });
    expect(text).not.toMatch(/had a look at your site/i);
    expect(text).toContain("You already have a site");
  });

  it("does not claim to be local to the business", () => {
    // PROFILE places Joshua in Bulacan. Writing "here in Cebu" to a Cebu clinic
    // is a false claim of local presence, and the searches now run in Austin and
    // Sydney too.
    const text = firstMessage({ ...vet });
    expect(text).not.toMatch(/here in Cebu/i);
    expect(text).toContain("here in the Philippines");
  });

  it("stays short enough to read on a phone", () => {
    // A cold WhatsApp message is read between customers. Length is the message.
    expect(firstMessage({ ...vet }).length).toBeLessThan(400);
  });
});

describe("isSharedHost", () => {
  it("recognises platform domains that many businesses share", () => {
    // Suppressing one of these on a single "no" would block every other
    // business using the same site builder.
    for (const d of ["weebly.com", "wixsite.com", "business.site", "blogspot.com"]) {
      expect(isSharedHost(d)).toBe(true);
    }
  });

  it("leaves a business's own domain alone", () => {
    for (const d of ["chonghua.com.ph", "vetcebu.ph", "lynnettechu.com"]) {
      expect(isSharedHost(d)).toBe(false);
    }
  });

  it("does not care about case", () => {
    expect(isSharedHost("WEEBLY.COM")).toBe(true);
  });
});
