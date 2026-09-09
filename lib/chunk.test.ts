import { describe, expect, it } from "vitest";
import { INSERT_BATCH, chunk } from "./chunk";

describe("chunk", () => {
  it("returns nothing for an empty list, so a caller's loop does not run", () => {
    expect(chunk([])).toEqual([]);
  });

  it("keeps a short list as one batch", () => {
    expect(chunk([1, 2, 3], 5)).toEqual([[1, 2, 3]]);
  });

  it("splits on the boundary without an empty trailing batch", () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("carries the remainder in a short final batch", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("loses nothing and reorders nothing", () => {
    const items = Array.from({ length: 1_234 }, (_, i) => i);
    expect(chunk(items, 100).flat()).toEqual(items);
  });

  it("stays under Postgres's 65,535 bind parameters for this table", () => {
    // The prospects insert names 32 columns per row — counted from the failed
    // statement in `searches.error`, not guessed. The default batch has to leave
    // room for all of them, or the ORM stops being the thing that breaks and
    // Postgres starts.
    const PROSPECT_COLUMNS = 32;
    expect(INSERT_BATCH * PROSPECT_COLUMNS).toBeLessThan(65_535);
  });

  it("refuses a size that would loop for ever", () => {
    expect(() => chunk([1, 2, 3], 0)).toThrow(/at least 1/);
  });
});
