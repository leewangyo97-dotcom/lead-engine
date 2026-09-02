import { describe, expect, it } from "vitest";
import { parseArgs } from "./cli-args";

describe("parseArgs", () => {
  it("reads --limit, which is how the nightly job bounds a run", () => {
    expect(parseArgs(["--limit=25"])).toEqual({ searchId: undefined, limit: 25 });
  });

  it("reads a search id with a positional limit", () => {
    expect(parseArgs(["abc123", "10"])).toEqual({ searchId: "abc123", limit: 10 });
  });

  it("does not mistake a flag for a search id", () => {
    expect(parseArgs(["--limit=5"]).searchId).toBeUndefined();
  });

  it("falls back rather than treating a bad limit as unbounded", () => {
    // A misspelt flag reading as "no limit" would turn a polite crawler into an
    // impolite one, silently.
    expect(parseArgs(["--limit=abc"], 50).limit).toBe(50);
    expect(parseArgs(["--limit=0"], 50).limit).toBe(50);
    expect(parseArgs(["--limit=-5"], 50).limit).toBe(50);
    expect(parseArgs([], 50).limit).toBe(50);
  });

  it("lets an explicit limit win over the fallback", () => {
    expect(parseArgs(["--limit=25"], 50).limit).toBe(25);
  });
});
