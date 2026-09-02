import { describe, expect, it } from "vitest";
import { cleanEmail } from "./email";

describe("cleanEmail", () => {
  it("drops the full stop that ended the sentence", () => {
    // This exact value reached Gmail and was rejected with INVALID_ARGUMENT.
    expect(cleanEmail("hackernewshiring@atria.org.")).toBe("hackernewshiring@atria.org");
  });

  it("strips wrapping punctuation", () => {
    expect(cleanEmail("<jobs@example.com>")).toBe("jobs@example.com");
    expect(cleanEmail("(jobs@example.com),")).toBe("jobs@example.com");
  });

  it("keeps a plain address untouched apart from case", () => {
    expect(cleanEmail("Jobs@Example.com")).toBe("jobs@example.com");
    expect(cleanEmail("first.last+tag@sub.example.co.uk")).toBe("first.last+tag@sub.example.co.uk");
  });

  it("returns nothing rather than a broken address", () => {
    expect(cleanEmail("not an email")).toBeNull();
    expect(cleanEmail("jobs@")).toBeNull();
    expect(cleanEmail("@example.com")).toBeNull();
    expect(cleanEmail(null)).toBeNull();
    expect(cleanEmail("")).toBeNull();
  });
});
