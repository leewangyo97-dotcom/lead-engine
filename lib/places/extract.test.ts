import { describe, expect, it } from "vitest";
import {
  extractEmails,
  extractSiteSignals,
  firstUsableEmail,
  isUsableEmail,
  looksLikePage,
  stripTags,
} from "./extract";

describe("isUsableEmail", () => {
  it("accepts an ordinary address", () => {
    expect(isUsableEmail("hello@clinic.com.au")).toBe(true);
  });

  it("refuses one with no top-level domain", () => {
    expect(isUsableEmail("info@heathmontfamilydentistry")).toBe(false);
  });

  it("refuses the srcset junk that scraping picks up", () => {
    expect(isUsableEmail("2x@example.com")).toBe(false);
  });
});
describe("firstUsableEmail", () => {
  it("takes the first address out of an OSM semicolon list", () => {
    // A real row: two addresses in one tag, which stored whole matches nothing.
    expect(firstUsableEmail("hello@grevillerdmd.com.au;admin@grevilleroadmc.com.au")).toBe(
      "hello@grevillerdmd.com.au",
    );
  });

  it("skips a broken first value rather than giving up", () => {
    expect(firstUsableEmail("not-an-address;real@clinic.com.au")).toBe("real@clinic.com.au");
  });

  it("refuses an address with no top-level domain", () => {
    // The other real row. A mailto: built from this goes nowhere.
    expect(firstUsableEmail("info@heathmontfamilydentistry")).toBeNull();
  });

  it("lowercases and trims, so the same address is one address", () => {
    expect(firstUsableEmail("  Info@Clinic.COM.AU ")).toBe("info@clinic.com.au");
  });

  it("handles commas as well, which OSM rows also use", () => {
    expect(firstUsableEmail("a@b.com, c@d.com")).toBe("a@b.com");
  });

  it("is null for nothing", () => {
    expect(firstUsableEmail(null)).toBeNull();
    expect(firstUsableEmail("")).toBeNull();
    expect(firstUsableEmail("   ")).toBeNull();
  });
});

describe("looksLikePage", () => {
  const page = `<!DOCTYPE html><html lang="en"><head><title>x</title></head><body>${"a".repeat(300)}</body></html>`;

  it("accepts a real page", () => {
    expect(looksLikePage(page)).toBe(true);
  });

  it("rejects the error body that caused this", () => {
    // 52 bytes, served with a 200 by some hosts. Measured for signals it reads
    // as "no viewport tag, no contact details" — facts about an error message,
    // recorded as facts about the business's website.
    expect(looksLikePage("403 - Forbidden | Access to this page is forbidden.\n")).toBe(false);
  });

  it("rejects an empty body", () => {
    expect(looksLikePage("")).toBe(false);
  });

  it("rejects a long response that is not html", () => {
    expect(looksLikePage(JSON.stringify({ error: "blocked" }).padEnd(900, " "))).toBe(false);
  });

  it("accepts a genuinely tiny page, which a byte floor would have refused", () => {
    expect(looksLikePage("<html><body>Call us</body></html>")).toBe(true);
  });

  it("accepts a page that opens with body rather than html", () => {
    expect(looksLikePage(`<body>${"x".repeat(300)}</body>`)).toBe(true);
  });
});

describe("parsing rather than pattern-matching", () => {
  it("finds a viewport tag whose attribute is unquoted", () => {
    // Valid HTML, and the regex this replaced required quotes — so it reported
    // "no viewport tag", which is the false claim that reached a draft about a
    // real company's website.
    const html = `<html><head><meta name=viewport content="width=device-width"></head><body>x</body></html>`;
    expect(extractSiteSignals(html, "https://x/").noViewport).toBe(false);
  });

  it("still reports a page that genuinely has none", () => {
    // A real Weebly site in the table has no viewport tag at all, and a message
    // may honestly say so.
    const html = `<html><head><title>x</title></head><body>y</body></html>`;
    expect(extractSiteSignals(html, "https://x/").noViewport).toBe(true);
  });

  it("recovers an email written as an HTML entity", () => {
    // A standard dodge against scrapers. The regex read it as literal text and
    // found nothing, so the business looked unreachable by email.
    const html = `<html><body><p>Write to info&#64;clinic.com.au anytime</p></body></html>`;
    expect(extractEmails(html).map((e) => e.email)).toContain("info@clinic.com.au");
  });

  it("does not read script or style content as page text", () => {
    const html = `<html><body><script>var a="book an appointment"</script><p>hello</p></body></html>`;
    expect(stripTags(html)).toBe("hello");
  });
});

describe("text extraction keeps words apart", () => {
  it("does not fuse adjacent elements into an invented address", () => {
    // cheerio's .text() concatenates with nothing between, which turned a footer
    // address beside a "Home" link into info@cdwstudios.comhomebachelor — a
    // structurally valid address that isUsableEmail would have accepted into the
    // table. Found against the real page, not a fixture.
    const html = `<html><body><a href="/x">info@clinic.com.au</a><a href="/y">Home</a></body></html>`;
    expect(extractEmails(html).map((e) => e.email)).toEqual(["info@clinic.com.au"]);
  });

  it("separates block text", () => {
    const html = `<html><body><p>one</p><p>two</p></body></html>`;
    expect(stripTags(html)).toBe("one two");
  });
});
