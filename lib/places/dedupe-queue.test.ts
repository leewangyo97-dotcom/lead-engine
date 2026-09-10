import { describe, expect, it } from "vitest";
import { dedupeByPhone } from "./dedupe-queue";

const row = (id: string, phoneE164: string | null) => ({ id, phoneE164 });

describe("dedupeByPhone", () => {
  it("keeps the first row for a number and drops the rest", () => {
    // The real shape: twelve preschools on one council switchboard.
    const rows = [row("a", "+61356292067"), row("b", "+61356292067"), row("c", "+61356292067")];
    expect(dedupeByPhone(rows).map((r) => r.id)).toEqual(["a"]);
  });

  it("respects the caller's order, because that order is the ranking", () => {
    // `queryProspects` sorts by score before this runs, so first means best.
    const rows = [row("best", "+61 1"), row("worse", "+61 1")];
    expect(dedupeByPhone(rows)[0].id).toBe("best");
  });

  it("never merges rows without a phone", () => {
    const rows = [row("a", null), row("b", null), row("c", null)];
    expect(dedupeByPhone(rows).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("leaves distinct numbers alone", () => {
    const rows = [row("a", "+61 1"), row("b", "+61 2"), row("c", "+61 3")];
    expect(dedupeByPhone(rows)).toHaveLength(3);
  });

  it("mixes the two cases without losing the unphoned", () => {
    const rows = [row("a", "+61 1"), row("b", null), row("c", "+61 1"), row("d", null)];
    expect(dedupeByPhone(rows).map((r) => r.id)).toEqual(["a", "b", "d"]);
  });

  it("returns an empty list unchanged", () => {
    expect(dedupeByPhone([])).toEqual([]);
  });
});
