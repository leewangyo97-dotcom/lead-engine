import { describe, expect, it } from "vitest";
import { decodeCfEmail, extractEmails, unhideEmails } from "./extract";

/** Cloudflare's scheme, run forwards: the key byte, then each character XOR'd with it. */
function cfEncode(email: string, key = 0x5a): string {
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return hex(key) + [...email].map((c) => hex(c.charCodeAt(0) ^ key)).join("");
}

describe("decodeCfEmail", () => {
  it("reads an address Cloudflare protected", () => {
    expect(decodeCfEmail(cfEncode("info@baydental.com.au"))).toBe("info@baydental.com.au");
    expect(decodeCfEmail(cfEncode("hello@x.co", 0x13))).toBe("hello@x.co");
  });

  it("refuses anything that does not decode to an address", () => {
    expect(decodeCfEmail("zz")).toBeNull();
    expect(decodeCfEmail(cfEncode("not an address"))).toBeNull();
  });
});

describe("unhideEmails", () => {
  it("turns a protected link back into a mailto", () => {
    const html = `<a href="/cdn-cgi/l/email-protection#${cfEncode("bookings@clinic.com")}">Email us</a>`;
    expect(unhideEmails(html)).toContain('href="mailto:bookings@clinic.com"');
  });

  it("turns a protected span back into the address", () => {
    const html = `<p>Write to <span class="__cf_email__" data-cfemail="${cfEncode("office@firm.ph")}">[email&#160;protected]</span></p>`;
    expect(unhideEmails(html)).toContain(">office@firm.ph</span>");
  });

  it("joins an address spelled out in brackets", () => {
    expect(unhideEmails("Email: info [at] smiledental [dot] com [dot] au")).toContain("info@smiledental.com.au");
    expect(unhideEmails("hello(at)vet-hq(dot)com")).toContain("hello@vet-hq.com");
  });

  it("decodes an @ and a dot written as entities", () => {
    expect(unhideEmails('<a href="mailto:info&#64;roof&#46;com">x</a>')).toContain("mailto:info@roof.com");
  });

  it("leaves ordinary words alone", () => {
    const text = "Meet us at the clinic, dot your i's";
    expect(unhideEmails(text)).toBe(text);
  });
});

describe("extractEmails", () => {
  it("finds hidden addresses, a protected link counting as the business stating it", () => {
    const html =
      `<a href="/cdn-cgi/l/email-protection#${cfEncode("bookings@clinic.com")}">Email</a>` +
      `<p>or reception [at] clinic [dot] com</p>`;
    expect(extractEmails(html)).toEqual([
      { email: "bookings@clinic.com", confidence: "mailto" },
      { email: "reception@clinic.com", confidence: "text" },
    ]);
  });
});
