import { describe, expect, it } from "vitest";
import { daysSince, gmailSearchUrl, whatsappChatUrl } from "./replies";

describe("where to look for an answer", () => {
  it("searches Gmail for mail from the address, kept in the fragment", () => {
    const url = gmailSearchUrl(" Info@BayDental.com ");
    expect(url).toBe("https://mail.google.com/mail/u/0/#search/from%3Ainfo%40baydental.com");
    // Everything after # stays in the browser: the address never reaches a server log.
    expect(url.split("#")[0]).not.toContain("baydental");
  });

  it("opens the WhatsApp chat with the number, digits only", () => {
    expect(whatsappChatUrl("+63 915 858 7388")).toBe("https://wa.me/639158587388");
  });
});

describe("daysSince", () => {
  it("counts calendar days in Manila, not 24-hour blocks", () => {
    // 23:30 Manila on the 14th, and 00:30 Manila on the 15th: one day, an hour apart.
    expect(daysSince(new Date("2026-10-14T15:30:00Z"), new Date("2026-10-14T16:30:00Z"))).toBe(1);
    expect(daysSince(new Date("2026-10-14T01:00:00Z"), new Date("2026-10-14T10:00:00Z"))).toBe(0);
    expect(daysSince(new Date("2026-09-09T02:00:00Z"), new Date("2026-10-15T02:00:00Z"))).toBe(36);
  });

  it("never goes below zero for a clock that is slightly ahead", () => {
    expect(daysSince(new Date("2026-10-15T02:00:00Z"), new Date("2026-10-14T02:00:00Z"))).toBe(0);
  });
});
