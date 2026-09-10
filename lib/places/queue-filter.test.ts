import { describe, expect, it } from "vitest";
import { categoryLabel, filterHref, isFiltered, parseQueueFilter } from "./queue-filter";

describe("parseQueueFilter", () => {
  it("is empty when nothing is asked for", () => {
    expect(parseQueueFilter({})).toEqual({});
    expect(isFiltered({})).toBe(false);
  });

  it("takes a known category", () => {
    expect(parseQueueFilter({ category: "clinics" })).toEqual({ category: "clinics" });
  });

  it("drops an unknown category rather than passing it to SQL", () => {
    // A mistyped link then shows the whole queue, not an empty page with no
    // explanation for why.
    expect(parseQueueFilter({ category: "dentists'; drop table prospects--" })).toEqual({});
    expect(parseQueueFilter({ category: "hospitals" })).toEqual({});
  });

  it("keeps a city as free text, because OSM localities are not a closed set", () => {
    expect(parseQueueFilter({ city: "Koo Wee Rup" })).toEqual({ city: "Koo Wee Rup" });
  });

  it("trims a city and ignores a blank one", () => {
    expect(parseQueueFilter({ city: "  Cebu City  " })).toEqual({ city: "Cebu City" });
    expect(parseQueueFilter({ city: "   " })).toEqual({});
  });

  it("refuses a city longer than any real locality", () => {
    expect(parseQueueFilter({ city: "x".repeat(81) })).toEqual({});
    expect(parseQueueFilter({ city: "x".repeat(80) }).city).toHaveLength(80);
  });

  it("takes the first value when a parameter is repeated", () => {
    expect(parseQueueFilter({ city: ["Cebu", "Austin"], category: ["clinics", "hotels"] })).toEqual({
      city: "Cebu",
      category: "clinics",
    });
  });
});

describe("filterHref", () => {
  it("is the bare path when nothing is set", () => {
    expect(filterHref("/prospects", {}, {})).toBe("/prospects");
  });

  it("adds a filter without losing the other one", () => {
    expect(filterHref("/prospects", { city: "Cebu" }, { category: "clinics" })).toBe(
      "/prospects?city=Cebu&category=clinics",
    );
  });

  it("clears a filter when it is set to undefined, so a chip can toggle", () => {
    expect(filterHref("/prospects", { city: "Cebu", category: "clinics" }, { category: undefined })).toBe(
      "/prospects?city=Cebu",
    );
  });

  it("encodes a city with spaces", () => {
    expect(filterHref("/prospects", {}, { city: "Koo Wee Rup" })).toBe(
      "/prospects?city=Koo+Wee+Rup",
    );
  });
});

describe("categoryLabel", () => {
  it("splits a camelCase category for display", () => {
    expect(categoryLabel("medicalSpecialists")).toBe("Medical specialists");
    expect(categoryLabel("veterinaryHospitals")).toBe("Veterinary hospitals");
  });

  it("leaves a single word alone but capitalised", () => {
    expect(categoryLabel("clinics")).toBe("Clinics");
  });
});
