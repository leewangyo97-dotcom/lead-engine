import { describe, expect, it } from "vitest";
import { BANDS, toBands } from "./distribution";

describe("toBands", () => {
  it("labels the bands high first, as the design draws them", () => {
    expect(toBands([1, 2, 3, 4, 5]).map((b) => b.label)).toEqual([
      "81–100",
      "61–80",
      "41–60",
      "21–40",
      "0–20",
    ]);
  });

  it("covers 0 to 100 with no gap and no overlap", () => {
    for (let i = 1; i < BANDS.length; i++) {
      // Bands run high to low, so each one ends where the next begins.
      expect(BANDS[i - 1].min).toBe(BANDS[i].max + 1);
    }
    expect(BANDS[0].max).toBe(100);
    expect(BANDS[BANDS.length - 1].min).toBe(0);
  });

  it("scales bars to the largest band, not to the total", () => {
    // Scaled to the total these would be 10/20/70; the shape of the spread is
    // what the card is for, so the largest band fills the track.
    expect(toBands([10, 20, 70, 0, 0]).map((b) => b.width)).toEqual([14, 29, 100, 0, 0]);
  });

  it("draws nothing rather than dividing by zero when no lead is scored", () => {
    const bands = toBands([0, 0, 0, 0, 0]);
    expect(bands.every((b) => b.width === 0 && b.count === 0)).toBe(true);
  });

  it("treats a missing count as zero", () => {
    expect(toBands([5]).map((b) => b.count)).toEqual([5, 0, 0, 0, 0]);
  });
});
