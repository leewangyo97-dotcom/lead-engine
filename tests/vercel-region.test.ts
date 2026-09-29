import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Vercel's functions must run beside the database.
 *
 * Neon is in ap-southeast-1 (Singapore). With no region set, Vercel Hobby runs
 * functions in iad1 (Washington, D.C.), so every query crossed the Pacific and
 * back — about 200 ms each, measured against 45 ms from Manila — and pages
 * that make four or five of them took a second or more before rendering. sin1
 * is Singapore. If the database ever moves, this moves with it.
 */
const config = JSON.parse(readFileSync("vercel.json", "utf8"));

describe("vercel.json", () => {
  it("pins functions to Singapore, where Neon is", () => {
    expect(config.regions).toEqual(["sin1"]);
  });

  it("still has no crons — the scheduler is GitHub Actions (CLAUDE.md rule 5)", () => {
    expect(config.crons).toBeUndefined();
  });
});
