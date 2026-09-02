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
