import { describe, expect, it } from "vitest";
import { runs } from "../lib/db/schema";
import { getDb } from "../lib/db";

describe("phase 0 skeleton", () => {
  it("declares the runs table used by the Phase 3 keepalive", () => {
    expect(Object.keys(runs)).toContain("kind");
  });

  it("refuses to build a client without DATABASE_URL", () => {
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    expect(() => getDb()).toThrow(/DATABASE_URL/);
    if (prev !== undefined) process.env.DATABASE_URL = prev;
  });
});
