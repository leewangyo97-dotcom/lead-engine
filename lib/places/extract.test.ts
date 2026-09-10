import { describe, expect, it } from "vitest";
import { firstUsableEmail, isUsableEmail } from "./extract";

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
