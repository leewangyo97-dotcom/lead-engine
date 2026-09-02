import { describe, expect, it } from "vitest";
import {
  buildAreaQuery,
  buildRadiusQuery,
  categoryOf,
  friendlyOverpassError,
  toRawPlace,
} from "./overpass";
import { toGeocodedPlace } from "./nominatim";
import { RateLimiter } from "./rate-limit";
import { normalizeName, rootDomain } from "./normalize";
import { buildWhatsAppLink, isWhatsAppCapable, toE164 } from "./phone";

describe("overpass queries", () => {
  it("always sets an explicit timeout", () => {
    // An unbounded query is against Overpass policy and gets killed at an
    // unpredictable point rather than a chosen one.
    expect(buildRadiusQuery({ lat: 10.3, lon: 123.9, radiusM: 15000, categories: ["veterinary"] }))
      .toMatch(/^\[out:json\]\[timeout:90\];/);
    expect(buildAreaQuery(12455830, ["veterinary"])).toMatch(/^\[out:json\]\[timeout:180\];/);
  });

  it("expands one category into every tag that means it", () => {
    const q = buildRadiusQuery({ lat: 1, lon: 2, radiusM: 100, categories: ["clinics"] });
    expect(q).toContain('nwr["amenity"="clinic"](around:100,1,2);');
    expect(q).toContain('nwr["amenity"="doctors"](around:100,1,2);');
    expect(q).toContain('nwr["healthcare"="clinic"](around:100,1,2);');
  });

  it("offsets the relation id into an Overpass area id", () => {
    // 3600000000 + osm_id. Getting this wrong silently searches the wrong place.
    expect(buildAreaQuery(12455830, ["veterinary"])).toContain("area(3612455830)");
  });

  it("rounds the radius, since Overpass rejects a fractional one", () => {
    const q = buildRadiusQuery({ lat: 1, lon: 2, radiusM: 15000.7, categories: ["gyms"] });
    expect(q).toContain("(around:15001,1,2)");
  });
});

describe("element mapping", () => {
  const base = { type: "node" as const, id: 42 };

  it("prefers contact: tags over the bare ones", () => {
    const p = toRawPlace(
      {
        ...base,
        lat: 10,
        lon: 123,
        tags: {
          amenity: "veterinary",
          name: "Cordova Vet",
          website: "http://old.example",
          "contact:website": "https://new.example",
          "contact:phone": "+63 32 555 0000",
        },
      },
      ["veterinary"],
    );
    expect(p?.website).toBe("https://new.example");
    expect(p?.phone).toBe("+63 32 555 0000");
  });

  it("takes coordinates from center for ways and relations", () => {
    // `out center` is why a building mapped as a way has any coordinate at all.
    const p = toRawPlace(
      { type: "way", id: 7, center: { lat: 10.5, lon: 123.5 }, tags: { amenity: "school", name: "X" } },
      ["schools"],
    );
    expect(p).toMatchObject({ lat: 10.5, lon: 123.5, sourceId: "osm:way/7" });
  });

  it("drops unnamed places", () => {
    // A lead with no name cannot be contacted or deduped.
    expect(toRawPlace({ ...base, lat: 1, lon: 2, tags: { amenity: "school" } }, ["schools"])).toBeNull();
  });

  it("drops anything outside the requested categories", () => {
    expect(
      toRawPlace({ ...base, lat: 1, lon: 2, tags: { amenity: "bar", name: "Y" } }, ["schools"]),
    ).toBeNull();
  });

  it("labels a place by the category that matched", () => {
    expect(categoryOf({ healthcare: "clinic" }, ["veterinary", "clinics"])).toBe("clinics");
    expect(categoryOf({ amenity: "bar" }, ["clinics"])).toBeNull();
  });
});

describe("geocoding", () => {
  const relation = {
    lat: "12.75",
    lon: "122.73",
    display_name: "Philippines",
    osm_type: "relation",
    osm_id: 443174,
    addresstype: "country",
    address: { country_code: "ph" },
  };

  it("marks a country as an area, because a radius around its centroid is sea", () => {
    expect(toGeocodedPlace(relation).isArea).toBe(true);
    expect(toGeocodedPlace(relation).countryCode).toBe("PH");
  });

  it("treats a city as a radius search", () => {
    const city = { ...relation, display_name: "Cebu City", addresstype: "city", osm_id: 12455830 };
    expect(toGeocodedPlace(city).isArea).toBe(false);
  });
});

describe("error messages", () => {
  it("turns rate limiting and exhaustion into something actionable", () => {
    expect(friendlyOverpassError("https://x failed after 3 attempts: 429")).toMatch(/rate limiting/);
    expect(friendlyOverpassError("https://x failed after 3 attempts: 504")).toMatch(/busy/);
  });

  it("passes anything else through unchanged", () => {
    expect(friendlyOverpassError("DNS failure")).toBe("DNS failure");
  });
});

describe("rate limiter", () => {
  it("serialises calls and spaces them by the interval", async () => {
    let clock = 0;
    const starts: number[] = [];
    const limiter = new RateLimiter(
      1000,
      async (ms) => {
        clock += ms;
      },
      () => clock,
    );

    await Promise.all(
      [1, 2, 3].map((n) =>
        limiter.run(async () => {
          starts.push(clock);
          return n;
        }),
      ),
    );

    // Nominatim's limit is per IP and absolute: three callers must not fire
    // together just because each slept independently.
    expect(starts).toEqual([0, 1000, 2000]);
  });

  it("keeps running after a call rejects", async () => {
    const limiter = new RateLimiter(0);
    await expect(limiter.run(async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    // A broken chain would reject every later call for the life of the process.
    await expect(limiter.run(async () => "fine")).resolves.toBe("fine");
  });
});

describe("dedupe identity", () => {
  it("collapses legal-form noise so one business is one lead", () => {
    expect(normalizeName("Cordova Veterinary Clinic, Inc.")).toBe("cordova veterinary clinic");
    expect(normalizeName("The Pet's Point Co.")).toBe("pet s point");
    expect(normalizeName("Gorre  Animal   Health")).toBe("gorre animal health");
  });

  it("keeps category words, which distinguish real businesses", () => {
    // "Santos Clinic" and "Santos Pharmacy" are not the same practice.
    expect(normalizeName("Santos Clinic")).not.toBe(normalizeName("Santos Pharmacy"));
  });

  it("normalises accents and ampersands", () => {
    expect(normalizeName("Café & Co")).toBe(normalizeName("Cafe and"));
  });

  it("reduces a chain's branches to one registrable domain", () => {
    expect(rootDomain("https://www.vetclinic.com/cebu")).toBe("vetclinic.com");
    expect(rootDomain("http://branch2.vetclinic.com")).toBe("vetclinic.com");
    expect(rootDomain("vetclinic.com")).toBe("vetclinic.com");
  });

  it("keeps two-level public suffixes intact", () => {
    // Trimming to "com.ph" would merge every Philippine business into one lead.
    expect(rootDomain("https://clinic.com.ph")).toBe("clinic.com.ph");
    expect(rootDomain("https://www.branch.clinic.com.ph")).toBe("clinic.com.ph");
  });

  it("returns null rather than guessing at unusable input", () => {
    expect(rootDomain(null)).toBeNull();
    expect(rootDomain("")).toBeNull();
    expect(rootDomain("not a url")).toBeNull();
    expect(rootDomain("localhost")).toBeNull();
  });
});

describe("phone normalisation", () => {
  it("parses the shapes OpenStreetMap actually holds", () => {
    // All three are real values from one Cebu search.
    expect(toE164("+63322382289", "PH")).toBe("+63322382289");
    expect(toE164("+63 32 344-1238", "PH")).toBe("+63323441238");
    expect(toE164("(032) 123 4567", "PH")).toBe("+63321234567");
  });

  it("takes the first valid number from a list", () => {
    // OSM separates multiple numbers with ";" — storing the whole string would
    // produce a wa.me link to a number that does not exist.
    expect(toE164("+63 32 344-1238;+63 917 555 0000", "PH")).toBe("+63323441238");
  });

  it("returns null rather than guessing", () => {
    // A broken WhatsApp link is worse than none: the user finds out after the
    // chat opens on the wrong person.
    expect(toE164("call us!", "PH")).toBeNull();
    expect(toE164("", "PH")).toBeNull();
    expect(toE164(null)).toBeNull();
    expect(toE164("12", "PH")).toBeNull();
  });

  it("builds a wa.me link with bare digits", () => {
    const url = buildWhatsAppLink("+63 917 555 0000".replace(/\s/g, ""), "hi there");
    expect(url).toBe("https://wa.me/639175550000?text=hi%20there");
  });

  it("treats an unknown line type as usable", () => {
    // Many valid mobiles report undefined; calling those "not mobile" would
    // discard the channel that matters most in this market.
    expect(isWhatsAppCapable("+639175550000")).toBe(true);
    expect(isWhatsAppCapable(null)).toBe(false);
    expect(isWhatsAppCapable("+1")).toBe(false);
  });
});
