import { describe, expect, it } from "vitest";
import { localityOf } from "./overpass";

describe("localityOf", () => {
  it("prefers addr:city where it is set", () => {
    expect(localityOf({ "addr:city": "Cebu City", "addr:suburb": "Lahug" })).toBe("Cebu City");
  });

  it("falls back to the suburb, which is what Australia uses", () => {
    // 217 of 20,107 Australian rows carry addr:city. Reading only that tag left
    // the column 97% empty while the answer sat under addr:suburb.
    expect(localityOf({ "addr:suburb": "Heathmont" })).toBe("Heathmont");
  });

  it("takes a town, village, municipality or hamlet before giving up", () => {
    expect(localityOf({ "addr:town": "Bunyip" })).toBe("Bunyip");
    expect(localityOf({ "addr:village": "Lang Lang" })).toBe("Lang Lang");
    expect(localityOf({ "addr:municipality": "Talisay" })).toBe("Talisay");
    expect(localityOf({ "addr:hamlet": "Koo Wee Rup" })).toBe("Koo Wee Rup");
  });

  it("treats blank and whitespace as absent, not as a place called nothing", () => {
    expect(localityOf({ "addr:city": "   ", "addr:suburb": "Fairfield" })).toBe("Fairfield");
    expect(localityOf({ "addr:city": "" })).toBeUndefined();
  });

  it("trims, so one suburb is one value", () => {
    expect(localityOf({ "addr:suburb": "  Bethania " })).toBe("Bethania");
  });

  it("is undefined when the row says nothing about where it is", () => {
    expect(localityOf({})).toBeUndefined();
  });
});
