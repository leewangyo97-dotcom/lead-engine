import { describe, expect, it } from "vitest";
import { applyOverrides, changedFields, mergeFromOsm, isOverridable } from "./refresh";
import { buildIdQuery } from "./overpass";
import type { RawPlace } from "./types";

type Row = Parameters<typeof mergeFromOsm>[0];

/** A stored prospect, with only the fields a refresh reads. */
function row(over: Partial<Row> = {}): Row {
  return {
    id: "p1",
    searchId: "s1",
    sourceId: "osm:node/1",
    sourceProvider: "overpass",
    name: "Cebu Vet",
    normalizedName: "cebu vet",
    category: "veterinary",
    website: null,
    rootDomain: null,
    addressLine: "1 Mango Ave",
    city: "Cebu City",
    countryCode: "ph",
    lat: 10.3,
    lon: 123.9,
    email: null,
    emailConfidence: null,
    phoneE164: "+63322382289",
    whatsappE164: null,
    facebookUrl: null,
    instagramUrl: null,
    linkedinUrl: null,
    contactName: null,
    enrichmentStatus: "pending",
    lastEnrichedAt: null,
    lastRefreshedAt: null,
    score: null,
    scoreReasons: null,
    status: "new",
    manualOverrides: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as Row;
}

function place(over: Partial<RawPlace> = {}): RawPlace {
  return {
    sourceId: "osm:node/1",
    sourceProvider: "overpass",
    name: "Cebu Vet",
    category: "veterinary",
    lat: 10.3,
    lon: 123.9,
    ...over,
  };
}

describe("applyOverrides", () => {
  it("lets a hand edit win over the scraped value", () => {
    const out = applyOverrides({ email: "old@x.ph", name: "X" }, { email: "real@x.ph" });
    expect(out.email).toBe("real@x.ph");
    expect(out.name).toBe("X");
  });

  it("honours a deliberately cleared field", () => {
    // Someone removed a wrong phone number by hand. A refresh that puts it back
    // is the failure that makes people stop trusting the button.
    expect(applyOverrides({ phoneE164: "+63322382289" }, { phoneE164: null }).phoneE164).toBeNull();
  });

  it("ignores fields nobody is allowed to override", () => {
    const out = applyOverrides({ name: "X" }, { score: 99, sourceId: "osm:node/999" }) as Record<
      string,
      unknown
    >;
    expect(out.score).toBeUndefined();
    expect(out.sourceId).toBeUndefined();
  });

  it("returns the values untouched when there are no overrides", () => {
    expect(applyOverrides({ name: "X" }, null)).toEqual({ name: "X" });
    expect(applyOverrides({ name: "X" }, {})).toEqual({ name: "X" });
  });
});

describe("isOverridable", () => {
  it("accepts contact fields and refuses derived ones", () => {
    expect(isOverridable("email")).toBe(true);
    expect(isOverridable("phoneE164")).toBe(true);
    expect(isOverridable("score")).toBe(false);
    expect(isOverridable("enrichmentStatus")).toBe(false);
    expect(isOverridable("id")).toBe(false);
  });
});

describe("mergeFromOsm", () => {
  it("takes the map's version of the facts the map holds", () => {
    const out = mergeFromOsm(row(), place({ name: "Cebu Veterinary Clinic", city: "Mandaue" }));
    expect(out.name).toBe("Cebu Veterinary Clinic");
    expect(out.city).toBe("Mandaue");
    expect(out.normalizedName).toBe("cebu veterinary clinic");
  });

  it("does not let a missing tag erase what we already have", () => {
    // An untagged phone means nobody filled it in, not that ours is wrong.
    const out = mergeFromOsm(row({ phoneE164: "+63322382289" }), place({ phone: undefined }));
    expect(out.phoneE164).toBe("+63322382289");
  });

  it("keeps a scraped email when the map still has none", () => {
    const out = mergeFromOsm(row({ email: "found@vet.ph" }), place());
    expect(out.email).toBe("found@vet.ph");
  });

  it("normalises a phone the map added since the last run", () => {
    const out = mergeFromOsm(row({ phoneE164: null }), place({ phone: "(032) 238 2289" }));
    expect(out.phoneE164).toBe("+63322382289");
  });

  it("recomputes the root domain when the website changes", () => {
    const out = mergeFromOsm(row(), place({ website: "https://www.vetcebu.com.ph/home" }));
    expect(out.website).toBe("https://www.vetcebu.com.ph/home");
    expect(out.rootDomain).toBe("vetcebu.com.ph");
  });

  it("leaves scraped social profiles alone — the map has no such tags", () => {
    const out = mergeFromOsm(row({ instagramUrl: "https://instagram.com/vet" }), place());
    expect(out.instagramUrl).toBe("https://instagram.com/vet");
  });
});

describe("mergeFromOsm with overrides", () => {
  it("re-applies a hand edit over fresh map data", () => {
    // The whole point of the feature: OSM says one thing, a person corrected it,
    // and the correction has to survive every refresh from now on.
    const stored = row({ manualOverrides: { phoneE164: "+639171234567" } });
    const fresh = mergeFromOsm(stored, place({ phone: "+63 32 238 2289" }));
    expect(fresh.phoneE164).toBe("+63322382289");

    const final = applyOverrides(fresh, stored.manualOverrides);
    expect(final.phoneE164).toBe("+639171234567");
  });
});

describe("changedFields", () => {
  it("lists only what actually differs", () => {
    const before = row({ name: "Old", city: "Cebu City" });
    expect(changedFields(before, { name: "New", city: "Cebu City" })).toEqual(["name"]);
  });

  it("treats null and undefined as the same absence", () => {
    expect(changedFields(row({ website: null }), { website: undefined })).toEqual([]);
  });

  it("reports nothing when a refresh finds nothing new", () => {
    const before = row();
    expect(changedFields(before, { name: before.name, city: before.city })).toEqual([]);
  });
});

describe("buildIdQuery", () => {
  it("groups ids by element type", () => {
    const q = buildIdQuery(["osm:node/1", "osm:node/2", "osm:way/9"]);
    expect(q).toContain("node(id:1,2);");
    expect(q).toContain("way(id:9);");
    expect(q).toContain("out center tags;");
  });

  it("always carries an explicit timeout, as Overpass policy requires", () => {
    expect(buildIdQuery(["osm:node/1"])).toMatch(/\[out:json\]\[timeout:\d+\]/);
  });

  it("skips ids it cannot parse rather than building a broken query", () => {
    const q = buildIdQuery(["osm:node/1", "google:place/abc", "nonsense"]);
    expect(q).toContain("node(id:1);");
    expect(q).not.toContain("abc");
  });
});
