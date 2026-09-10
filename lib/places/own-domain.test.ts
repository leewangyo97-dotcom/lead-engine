import { describe, expect, it } from "vitest";
import { domainOf, ownDomainFromEmail } from "./own-domain";

describe("ownDomainFromEmail", () => {
  it("catches the case that caused this", () => {
    // The record said no website; leurawellness.com.au serves a 349KB site
    // titled "Leura Wellness", and a draft told them they had none.
    expect(ownDomainFromEmail("Leura Wellness", "hello@leurawellness.com.au")).toBe(
      "leurawellness.com.au",
    );
  });

  it("catches it across a country suffix", () => {
    expect(ownDomainFromEmail("Hotel Elizabeth", "reservations@hotelelizabeth.com.ph")).toBe(
      "hotelelizabeth.com.ph",
    );
  });

  it("says nothing about a free provider", () => {
    expect(ownDomainFromEmail("Alberto's Pizza", "albertos@gmail.com")).toBeNull();
    expect(ownDomainFromEmail("Aku Inn", "akuinn@yahoo.com.ph")).toBeNull();
    expect(ownDomainFromEmail("The Daily Grind Cafe", "cafe@icloud.com")).toBeNull();
  });

  it("treats an ISP mailbox as a free provider", () => {
    // bigpond.com is Telstra's; a builder emailing from it has no site there.
    expect(ownDomainFromEmail("DJE Building Services", "djebuilding@bigpond.com")).toBeNull();
  });

  it("does not mistake an institution's domain for the business's own", () => {
    // These are the majority of the 117 non-free domains: a department or a
    // university, whose site is not the school's or the clinic's.
    expect(ownDomainFromEmail("Tangke Elementary School", "137117@deped.gov.ph")).toBeNull();
    expect(ownDomainFromEmail("Kensington Physiotherapy", "physio@unsw.edu.au")).toBeNull();
  });

  it("ignores case and punctuation in the name", () => {
    expect(ownDomainFromEmail("MIFAN Kitchen!", "hi@mifankitchen.ph")).toBe("mifankitchen.ph");
  });

  it("allows a domain that carries more than the name", () => {
    expect(ownDomainFromEmail("Doppio", "hi@doppiocoffee.com")).toBe("doppiocoffee.com");
  });

  it("refuses an overlap too short to mean anything", () => {
    // Two or three shared letters is coincidence, not ownership.
    expect(ownDomainFromEmail("Yola", "yola@abc.com")).toBeNull();
  });

  it("is null when there is no email at all", () => {
    expect(ownDomainFromEmail("Anything", null)).toBeNull();
    expect(ownDomainFromEmail("Anything", "")).toBeNull();
  });
});

describe("domainOf", () => {
  it("takes what follows the last at-sign", () => {
    expect(domainOf("a@b.com")).toBe("b.com");
    expect(domainOf("  HI@Clinic.COM.AU")).toBe("clinic.com.au");
  });

  it("is null for something that is not an address", () => {
    expect(domainOf("not-an-address")).toBeNull();
    expect(domainOf("@nolocal.com")).toBeNull();
    expect(domainOf("no@tld")).toBeNull();
    expect(domainOf(undefined)).toBeNull();
  });
});
