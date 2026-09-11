import { describe, expect, it } from "vitest";
import { groupByHost, hostOf } from "./host-groups";

const row = (website: string | null, id = website) => ({ website, id });

describe("groupByHost", () => {
  it("puts two rows on one website in the same group", () => {
    // The real pair: Easy Solutions Plumbing Sydney and North Shore share a
    // site, and fetching both at once is what the per-host pause prevents.
    const rows = [
      row("https://easysolutionsplumbing.com.au/", "sydney"),
      row("https://www.easysolutionsplumbing.com.au/contact", "north"),
    ];
    const groups = groupByHost(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0].map((r) => r.id)).toEqual(["sydney", "north"]);
  });

  it("keeps the queue order inside a group", () => {
    const rows = [row("https://x.com/a", "1"), row("https://x.com/b", "2"), row("https://x.com/c", "3")];
    expect(groupByHost(rows)[0].map((r) => r.id)).toEqual(["1", "2", "3"]);
  });

  it("gives unrelated sites their own groups, so they can run at once", () => {
    const rows = [row("https://a.com"), row("https://b.com"), row("https://c.com")];
    expect(groupByHost(rows)).toHaveLength(3);
  });

  it("treats www and the bare domain as one host", () => {
    expect(groupByHost([row("https://www.a.com"), row("https://a.com")])).toHaveLength(1);
  });

  it("does not merge rows that have no usable URL", () => {
    // Nothing to be polite to, and no reason to queue them behind each other.
    const rows = [row(null, "1"), row("not a url", "2"), row(null, "3")];
    expect(groupByHost(rows)).toHaveLength(3);
  });

  it("loses no row", () => {
    const rows = [row("https://a.com/1"), row("https://a.com/2"), row("https://b.com"), row(null)];
    expect(groupByHost(rows).flat()).toHaveLength(rows.length);
  });

  it("is empty for an empty queue", () => {
    expect(groupByHost([])).toEqual([]);
  });
});

describe("hostOf", () => {
  it("lowercases and drops www", () => {
    expect(hostOf("https://WWW.Example.COM/path")).toBe("example.com");
  });

  it("is null for anything that is not a URL", () => {
    expect(hostOf(null)).toBeNull();
    expect(hostOf("")).toBeNull();
    expect(hostOf("example.com")).toBeNull();
  });
});
