import { describe, expect, it } from "vitest";
import { normaliseSocial } from "./social";

describe("normaliseSocial", () => {
  it("turns the handles actually stored into links", () => {
    // 81 of 638 facebook values in the table are handles, not URLs. Stored raw
    // the row shows something and clicking it goes nowhere.
    expect(normaliseSocial("facebook", "@manimokocebu")).toBe(
      "https://www.facebook.com/manimokocebu",
    );
    expect(normaliseSocial("facebook", "cdwstudios")).toBe("https://www.facebook.com/cdwstudios");
    expect(normaliseSocial("facebook", "metrosports.lahug")).toBe(
      "https://www.facebook.com/metrosports.lahug",
    );
  });

  it("leaves a good URL alone but normalises its shape", () => {
    expect(normaliseSocial("facebook", "https://www.facebook.com/TullySHS/")).toBe(
      "https://www.facebook.com/TullySHS",
    );
    expect(normaliseSocial("facebook", "facebook.com/weereninsurance")).toBe(
      "https://www.facebook.com/weereninsurance",
    );
    expect(normaliseSocial("facebook", "//m.facebook.com/hpdiagnostics")).toBe(
      "https://www.facebook.com/hpdiagnostics",
    );
  });

  it("accepts Facebook's own shortener", () => {
    expect(normaliseSocial("facebook", "https://fb.com/someshop")).toBe(
      "https://www.facebook.com/someshop",
    );
  });

  it("refuses a share button, which belongs to whoever clicked it", () => {
    // The failure scraping would produce: these match any naive pattern and are
    // not the business's page.
    expect(
      normaliseSocial("facebook", "https://www.facebook.com/sharer/sharer.php?u=https://x.com"),
    ).toBeNull();
    expect(normaliseSocial("facebook", "https://www.facebook.com/plugins/like.php")).toBeNull();
    expect(normaliseSocial("facebook", "https://www.facebook.com/tr?id=123")).toBeNull();
  });

  it("refuses another network's URL", () => {
    expect(normaliseSocial("facebook", "https://www.instagram.com/someshop")).toBeNull();
    expect(normaliseSocial("instagram", "https://www.facebook.com/someshop")).toBeNull();
  });

  it("keeps only a real LinkedIn profile or company page", () => {
    expect(normaliseSocial("linkedin", "https://www.linkedin.com/company/acme/about/")).toBe(
      "https://www.linkedin.com/company/acme",
    );
    expect(normaliseSocial("linkedin", "https://www.linkedin.com/in/joshua-senining")).toBe(
      "https://www.linkedin.com/in/joshua-senining",
    );
    expect(normaliseSocial("linkedin", "https://www.linkedin.com/feed/")).toBeNull();
    expect(normaliseSocial("linkedin", "https://www.linkedin.com/company/")).toBeNull();
  });

  it("refuses an Instagram post or reel, which is not an account", () => {
    expect(normaliseSocial("instagram", "https://www.instagram.com/p/Cabc123/")).toBeNull();
    expect(normaliseSocial("instagram", "https://www.instagram.com/reel/Cxyz/")).toBeNull();
    expect(normaliseSocial("instagram", "https://www.instagram.com/abaseriaofficial/")).toBe(
      "https://www.instagram.com/abaseriaofficial",
    );
  });

  it("is null for nothing and for nonsense", () => {
    expect(normaliseSocial("facebook", null)).toBeNull();
    expect(normaliseSocial("facebook", "")).toBeNull();
    expect(normaliseSocial("facebook", "   ")).toBeNull();
    expect(normaliseSocial("facebook", "not a url or handle!!")).toBeNull();
  });
});

describe("/p/ means opposite things on the two networks", () => {
  it("keeps a Facebook page under /p/, which is a real page URL", () => {
    // A dry run over the table found 89 live links that a shared rule would have
    // cleared, this shape among them.
    expect(
      normaliseSocial("facebook", "https://www.facebook.com/p/Bonenone-Korean-Chicken-100091435368532/"),
    ).toBe("https://www.facebook.com/p/Bonenone-Korean-Chicken-100091435368532");
  });

  it("still refuses an Instagram post under /p/", () => {
    expect(normaliseSocial("instagram", "https://www.instagram.com/p/Cabc123/")).toBeNull();
  });

  it("refuses a Facebook /p/ with nothing after it", () => {
    expect(normaliseSocial("facebook", "https://www.facebook.com/p/")).toBeNull();
  });
});

describe("Facebook's older page URLs", () => {
  it("keeps /pages/<name>/<id>, which is a real page", () => {
    expect(
      normaliseSocial("facebook", "https://www.facebook.com/pages/Pet-Universe/117779078266601"),
    ).toBe("https://www.facebook.com/pages/Pet-Universe/117779078266601");
  });

  it("refuses a bare /pages, which is the platform", () => {
    expect(normaliseSocial("facebook", "https://www.facebook.com/pages")).toBeNull();
  });

  it("still refuses a tracking pixel", () => {
    // Scraped from real pages: facebook.com/tr appeared many times in the table.
    expect(normaliseSocial("facebook", "https://www.facebook.com/tr")).toBeNull();
  });
});
