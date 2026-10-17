import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { countryExtract } from "./geofabrik";
import { bboxCenter, featureToElement, tagFilters } from "./osmium";
import { toRawPlace } from "./overpass";

describe("tagFilters", () => {
  it("asks osmium for the same tags Overpass is asked for", () => {
    expect(tagFilters(["dentists", "clinics"])).toEqual([
      "nwr/amenity=dentist",
      "nwr/amenity=clinic",
      "nwr/amenity=doctors",
      "nwr/healthcare=clinic",
    ]);
  });
});

describe("countryExtract", () => {
  const index = {
    features: [
      { properties: { id: "canada", name: "Canada", "iso3166-1:alpha2": ["CA"], urls: { pbf: "https://x/canada-latest.osm.pbf" } } },
      { properties: { id: "ontario", name: "Ontario", urls: { pbf: "https://x/ontario-latest.osm.pbf" } } },
      {
        properties: {
          id: "malaysia-singapore-brunei",
          name: "Malaysia, Singapore, and Brunei",
          "iso3166-1:alpha2": ["MY", "SG", "BN"],
          urls: { pbf: "https://x/msb-latest.osm.pbf" },
        },
      },
      { properties: { id: "asia", name: "Asia", "iso3166-1:alpha2": ["SG", "PH"], urls: { pbf: "https://x/asia.osm.pbf" } } },
    ],
  };

  it("takes the country's own extract", () => {
    expect(countryExtract(index, "ca")?.id).toBe("canada");
  });

  it("takes the smallest shared extract when there is no own one", () => {
    expect(countryExtract(index, "SG")?.id).toBe("asia");
    expect(countryExtract(index, "MY")?.id).toBe("malaysia-singapore-brunei");
  });

  it("finds nothing for a country Geofabrik does not list", () => {
    expect(countryExtract(index, "ZZ")).toBeNull();
  });
});

describe("an exported feature, read the way Overpass's answer is read", () => {
  it("places a node at its own position", () => {
    const el = featureToElement({
      geometry: { type: "Point", coordinates: [6.13, 49.61] },
      properties: { "@type": "node", "@id": 42, amenity: "dentist", name: "Dent Lux" },
    });
    expect(el).toEqual({ type: "node", id: 42, lat: 49.61, lon: 6.13, tags: { amenity: "dentist", name: "Dent Lux" } });
    expect(toRawPlace(el!, ["dentists"])?.sourceId).toBe("osm:node/42");
  });

  it("places a way or relation at the centre of its bounding box, as `out center` does", () => {
    const el = featureToElement({
      geometry: { type: "Polygon", coordinates: [[[6, 49], [6.2, 49], [6.2, 49.4], [6, 49.4], [6, 49]]] },
      properties: { "@type": "way", "@id": 7, amenity: "clinic", name: "Clinique" },
    });
    expect(el?.center?.lat).toBeCloseTo(49.2);
    expect(el?.center?.lon).toBeCloseTo(6.1);
    expect(toRawPlace(el!, ["clinics"])?.sourceId).toBe("osm:way/7");
  });

  it("drops anything that is not a node, way or relation", () => {
    expect(featureToElement({ geometry: { type: "Point", coordinates: [0, 0] }, properties: { "@type": "area" } })).toBeNull();
  });

  it("finds no centre for an empty geometry", () => {
    expect(bboxCenter({ type: "MultiPolygon", coordinates: [] })).toBeNull();
  });
});

describe("the search queue on GitHub Actions", () => {
  it("installs osmium and turns the extract path on, with Overpass kept as the fallback", () => {
    const wf = readFileSync(".github/workflows/search-run.yml", "utf8");
    expect(wf).toContain("sudo apt-get install -y -q osmium-tool");
    expect(wf).toContain("PLACES_COUNTRY_SOURCE: geofabrik");
    const runner = readFileSync("lib/places/search-runner.ts", "utf8");
    expect(runner).toContain("if (place.isArea && !fromExtract) {");
    expect(runner).toContain("} else if (!place.isArea) {");
  });
});
