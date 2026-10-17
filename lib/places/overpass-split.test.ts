import { describe, expect, it } from "vitest";
import { buildAreaQuery, buildSubAreasQuery, OVERPASS_ENDPOINTS, overpassRemarkError } from "./overpass";
import { AREA_CONCURRENCY, partialNote } from "./search-runner";

describe("a country search, split to fit the free server", () => {
  it("asks for one category at a time, in place order", () => {
    const q = buildAreaQuery(1428125, ["dentists"]);
    expect(q).toContain("area(3601428125)->.searchArea;");
    expect(q.trimEnd().endsWith("out center tags qt;")).toBe(true);
  });

  it("finds a country's own provinces or states for a category too big to ask for at once", () => {
    const q = buildSubAreasQuery(1428125, "ca");
    expect(q).toContain("area(3601428125)->.c;");
    expect(q).toContain('["boundary"="administrative"]["admin_level"="4"]');
    // A neighbour's states share border nodes; the code prefix keeps them out.
    expect(q).toContain('["ISO3166-2"~"^CA-"]');
    expect(q).toContain("out ids;");
  });

  it("runs two categories at a time, the server's limit per client", () => {
    expect(AREA_CONCURRENCY).toBe(2);
  });

  it("falls back to a mirror after the main server", () => {
    expect(OVERPASS_ENDPOINTS[0]).toBe("https://overpass-api.de/api/interpreter");
    expect(OVERPASS_ENDPOINTS.length).toBeGreaterThan(1);
  });
});

describe("overpassRemarkError", () => {
  it("treats a timed-out or out-of-memory answer as a failure, not a short result", () => {
    expect(overpassRemarkError('runtime error: Query timed out in "query" at line 3 after 181 seconds.')).toMatch(
      /timed out/,
    );
    expect(overpassRemarkError("runtime error: Query run out of memory using about 2048 MB of RAM.")).toMatch(
      /memory/,
    );
  });

  it("lets a normal answer through", () => {
    expect(overpassRemarkError(undefined)).toBeNull();
    expect(overpassRemarkError("The data included in this document is from www.openstreetmap.org.")).toBeNull();
  });
});

describe("partialNote", () => {
  it("names the categories that did not load, and that the rest are kept", () => {
    expect(partialNote(["restaurants", "schools"], 21)).toBe(
      "2 of 21 categories did not load (restaurants, schools). Search again to retry them; the places already found are kept.",
    );
  });

  it("says nothing when everything loaded", () => {
    expect(partialNote([], 21)).toBeNull();
  });
});
