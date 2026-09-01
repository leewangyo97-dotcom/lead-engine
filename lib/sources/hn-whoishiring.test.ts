import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/hn-whoishiring.json";
import { hnWhoIsHiring, isDirectContact, parseHourlyUsd, detectRemoteScope } from "./hn-whoishiring";
import type { HnComment } from "./hn-whoishiring";
import { contentHash } from "./hash";
import { SUMMARY_MAX } from "./types";

const hits = fixture.hits as HnComment[];
const normalised = hits.map((h) => hnWhoIsHiring.normalise(h)).filter((l) => l !== null);

describe("hn-whoishiring", () => {
  it("normalises a real fixture into a valid NormalisedLead", () => {
    expect(normalised.length).toBeGreaterThan(0);
    for (const lead of normalised) {
      expect(lead.company).toBeTruthy();
      expect(lead.title).toBeTruthy();
      expect(lead.kind).toBe("job");
      expect(Array.isArray(lead.stack)).toBe(true);
      expect(lead.url).toMatch(/^https:\/\/news\.ycombinator\.com\/item\?id=\d+$/);
    }
  });

  // The one that matters. An unstable hash silently defeats the dedupe that
  // saves ~85% of the nightly cost, and it fails without ever raising an error.
  it("produces a stable contentHash across two runs", () => {
    const first = hits.map((h) => hnWhoIsHiring.normalise(h)).filter((l) => l !== null);
    const second = hits.map((h) => hnWhoIsHiring.normalise(h)).filter((l) => l !== null);
    expect(first.map(contentHash)).toEqual(second.map(contentHash));
  });

  it("hashes independently of harvest time and comment ordering", () => {
    const lead = normalised[0];
    const withNewTimestamp = { ...lead, postedAt: new Date("2030-01-01"), externalId: "999" };
    expect(contentHash(withNewTimestamp)).toBe(contentHash(lead));
  });

  it("returns null for malformed input instead of throwing", () => {
    const bad: HnComment[] = [
      { ...hits[0], comment_text: null },
      { ...hits[0], comment_text: "" },
      { ...hits[0], comment_text: "no pipes here at all, just prose" },
      { ...hits[0], comment_text: "<p>| | |</p>" },
    ];
    for (const b of bad) {
      expect(() => hnWhoIsHiring.normalise(b)).not.toThrow();
      expect(hnWhoIsHiring.normalise(b)).toBeNull();
    }
  });

  it("truncates summary to 400 chars", () => {
    for (const lead of normalised) {
      expect((lead.summary ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX);
    }
    const longest = normalised.find((l) => (l.summary ?? "").length === SUMMARY_MAX);
    expect(longest, "fixture should contain at least one posting long enough to truncate").toBeDefined();
  });

  it("detects isDirect correctly for personal vs ATS contacts", () => {
    expect(isDirectContact("dave@evanlee.co.uk")).toBe(true);
    expect(isDirectContact("joshua.senining@startup.io")).toBe(true);
    expect(isDirectContact("jobs@company.com")).toBe(false);
    expect(isDirectContact("careers@company.com")).toBe(false);
    expect(isDirectContact("hiring-eng@company.com")).toBe(false);
    expect(isDirectContact("apply@jobs.ashbyhq.com")).toBe(false);
    expect(isDirectContact("someone@greenhouse.io")).toBe(false);
  });

  it("reads remote scope from the header, not the body", () => {
    expect(detectRemoteScope("Acme | Eng | REMOTE (Worldwide)")).toBe("worldwide");
    expect(detectRemoteScope("Acme | Eng | REMOTE (US/Can)")).toBe("us");
    expect(detectRemoteScope("Acme | Eng | REMOTE (EMEA)")).toBe("emea");
    expect(detectRemoteScope("Acme | Eng | ONSITE NYC")).toBe("onsite");
    expect(detectRemoteScope("Acme | Eng | New York")).toBeUndefined();
  });

  it("derives pay only when the posting states it", () => {
    expect(parseHourlyUsd("Acme | Eng | $80/hr").minUsdHr).toBe(80);
    expect(parseHourlyUsd("Acme | Eng | $170-240K + equity").minUsdHr).toBe(82);
    expect(parseHourlyUsd("Acme | Eng | competitive salary").minUsdHr).toBeUndefined();
  });
});
