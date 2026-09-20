import { describe, expect, it } from "vitest";
import { claimsOf, measuredClaims, needsFetch } from "./draft-claims";

describe("claimsOf", () => {
  it("finds the claim that was false in the Leura Wellness draft", () => {
    const message =
      "Hi Leura Wellness — I'm Joshua, a web developer in the Philippines. You don't have a website yet, so someone looking for a clinic can't see which services you offer.";
    expect(claimsOf(message)).toEqual([{ kind: "no-website", quote: "don't have a website" }]);
  });

  it("finds both claims that were false in the CDW Studios draft", () => {
    const message =
      "Two things I noticed on cdwstudios.com: it has no viewport tag, so on a phone it renders at desktop width and people have to pinch to read it, and there's no contact detail anywhere on the page.";
    expect(claimsOf(message).map((c) => c.kind)).toEqual(["no-viewport", "no-contact-details"]);
  });

  it("catches the other phrasings of the same claim", () => {
    expect(claimsOf("Without a website, people can't find your menu.")[0].kind).toBe("no-website");
    expect(claimsOf("You have no website at the moment.")[0].kind).toBe("no-website");
    expect(claimsOf("You haven't got a site yet.")[0].kind).toBe("no-website");
  });

  it("reports one claim per kind, however often it is said", () => {
    const message = "You don't have a website. Without a website nobody can find you.";
    expect(claimsOf(message)).toHaveLength(1);
  });

  it("ignores what fetching a page could never settle", () => {
    // True or false, no request decides it, so it is not this function's
    // business — and treating it as checkable would produce noise.
    expect(claimsOf("Most people looking for a business like yours start on Google.")).toEqual([]);
    expect(claimsOf("A one-pager would bring you more bookings.")).toEqual([]);
  });

  it("says nothing about a message that makes no claim", () => {
    expect(claimsOf("Hi — would a free mockup be useful?")).toEqual([]);
  });
});

describe("needsFetch", () => {
  it("is true for a claim about the page itself", () => {
    expect(needsFetch(claimsOf("your site has no viewport tag"))).toBe(true);
    expect(needsFetch(claimsOf("there's no contact detail anywhere on the page"))).toBe(true);
  });

  it("is false for a no-website claim, which the record and the email settle first", () => {
    // Fetching needs a URL, and the whole point of the claim is that there is
    // none on file. That one is checked through the email domain instead.
    expect(needsFetch(claimsOf("you don't have a website"))).toBe(false);
  });

  it("is false when nothing was claimed", () => {
    expect(needsFetch([])).toBe(false);
  });
});

describe("measured claims", () => {
  // The wording here follows what `enhance.ts` hands the copywriter: a size in
  // megabytes, a count of elements failing contrast, images with no dimensions.
  it("catches a page-weight claim however it is phrased", () => {
    const kinds = (m: string) => claimsOf(m).map((c) => c.kind);
    expect(kinds("Their homepage loads 6.2 MB on a phone.")).toContain("page-weight");
    expect(kinds("your homepage is about 10 MB")).toContain("page-weight");
    expect(kinds("that's 4.5 megabytes before anyone reads a word")).toContain("page-weight");
  });

  it("catches a contrast claim", () => {
    const kinds = (m: string) => claimsOf(m).map((c) => c.kind);
    expect(kinds("31 elements on your homepage fail the contrast threshold")).toContain("contrast");
    expect(kinds("the low-contrast text is hard to read")).toContain("contrast");
  });

  it("catches an unsized-images claim", () => {
    const kinds = (m: string) => claimsOf(m).map((c) => c.kind);
    expect(kinds("26 images have no width or height set")).toContain("unsized-images");
    expect(kinds("the unsized images make the page jump")).toContain("unsized-images");
  });

  it("does not read a kilobyte figure as a page-weight claim", () => {
    // Nothing offers a weight below the 3 MB floor, so a draft talking in KB is
    // talking about something else and should not be flagged as unverifiable.
    expect(claimsOf("a 40 KB stylesheet")).toEqual([]);
  });

  // The trap. These cannot be settled by downloading the page — the weight is
  // mostly subresources this project never fetches, and contrast needs a render.
  // If `needsFetch` ever returns true for them the script pulls every site down
  // the wire, finds nothing that could disagree, and prints "ok".
  it("never asks for a fetch, because a fetch cannot settle them", () => {
    for (const m of [
      "Their homepage loads 6.2 MB.",
      "31 elements fail the contrast threshold.",
      "26 images have no width or height.",
    ]) {
      expect(needsFetch(claimsOf(m))).toBe(false);
      expect(measuredClaims(claimsOf(m))).toHaveLength(1);
    }
  });

  it("leaves fetchable claims out of the measured set", () => {
    expect(measuredClaims(claimsOf("your site has no viewport tag"))).toEqual([]);
    expect(measuredClaims([])).toEqual([]);
  });
});
