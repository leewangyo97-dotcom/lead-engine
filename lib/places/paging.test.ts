import { describe, expect, it } from "vitest";
import { PAGE_SIZE, pageLabel, pageOf, parsePage } from "./paging";

describe("pageOf", () => {
  it("describes the first page of a country-wide search", () => {
    // The real number: 13,134 rows, of which 200 were ever reachable.
    const page = pageOf(13_134, 1);
    expect(page).toMatchObject({
      number: 1,
      offset: 0,
      pages: 66,
      from: 1,
      to: 200,
      hasPrevious: false,
      hasNext: true,
    });
  });

  it("offsets by whole pages", () => {
    expect(pageOf(13_134, 3).offset).toBe(400);
    expect(pageOf(13_134, 3).from).toBe(401);
  });

  it("ends on a short last page without overrunning the total", () => {
    const page = pageOf(13_134, 66);
    expect(page.to).toBe(13_134);
    expect(page.hasNext).toBe(false);
  });

  it("clamps a page past the end onto the last one", () => {
    // A bookmark kept after rows were pruned should still show results rather
    // than an empty page that looks like the search found nothing.
    expect(pageOf(500, 99).number).toBe(3);
  });

  it("clamps zero and negatives to the first page", () => {
    expect(pageOf(500, 0).number).toBe(1);
    expect(pageOf(500, -4).number).toBe(1);
  });

  it("is a single page when everything fits", () => {
    const page = pageOf(151, 1);
    expect(page).toMatchObject({ pages: 1, hasNext: false, hasPrevious: false, to: 151 });
  });

  it("survives an empty search without dividing by zero", () => {
    const page = pageOf(0, 1);
    expect(page).toMatchObject({ pages: 1, from: 0, to: 0, hasNext: false });
  });

  it("defaults to the first page when none is asked for", () => {
    expect(pageOf(13_134, undefined).number).toBe(1);
  });

  it("uses the shared page size by default", () => {
    expect(pageOf(1_000, 1).size).toBe(PAGE_SIZE);
  });
});

describe("parsePage", () => {
  it("reads a number", () => {
    expect(parsePage("4")).toBe(4);
  });

  it("treats junk as no page rather than page zero", () => {
    expect(parsePage("abc")).toBeUndefined();
    expect(parsePage("")).toBeUndefined();
    expect(parsePage(undefined)).toBeUndefined();
    expect(parsePage("-2")).toBeUndefined();
  });

  it("floors a fractional page", () => {
    expect(parsePage("2.9")).toBe(2);
  });

  it("takes the first of a repeated parameter", () => {
    expect(parsePage(["2", "7"])).toBe(2);
  });
});

describe("pageLabel", () => {
  it("counts rows when they all fit", () => {
    expect(pageLabel(pageOf(151, 1))).toBe("151 rows");
    expect(pageLabel(pageOf(1, 1))).toBe("1 row");
  });

  it("gives a range when there is more than one page", () => {
    expect(pageLabel(pageOf(13_134, 2))).toBe("201–400 of 13134");
  });

  it("says so when there is nothing", () => {
    expect(pageLabel(pageOf(0, 1))).toBe("no rows");
  });
});
