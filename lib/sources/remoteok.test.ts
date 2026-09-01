import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/remoteok.json";
import { detectScope, remoteOk, stripHtml, type RemoteOkItem } from "./remoteok";
import { contentHash } from "./hash";
import { SUMMARY_MAX } from "./types";

const items = fixture as RemoteOkItem[];
const normalised = items.map((i) => remoteOk.normalise(i)).filter((l) => l !== null);

describe("remoteok", () => {
  it("normalises a real fixture into a valid NormalisedLead", () => {
    expect(normalised.length).toBe(items.length);
    for (const lead of normalised) {
      expect(lead.company).toBeTruthy();
      expect(lead.title).toBeTruthy();
      expect(lead.kind).toBe("job");
      expect(Array.isArray(lead.stack)).toBe(true);
    }
  });

  it("produces a stable contentHash across two runs", () => {
    const a = items.map((i) => remoteOk.normalise(i)).filter((l) => l !== null).map(contentHash);
    const b = items.map((i) => remoteOk.normalise(i)).filter((l) => l !== null).map(contentHash);
    expect(a).toEqual(b);
  });

  it("hashes independently of the feed's volatile fields", () => {
    const lead = normalised[0];
    // RemoteOK re-dates and re-slugs postings as they are bumped up the list.
    expect(contentHash({ ...lead, postedAt: new Date("2030-01-01"), externalId: "999" })).toBe(
      contentHash(lead),
    );
  });

  it("returns null for malformed input instead of throwing", () => {
    for (const bad of [{}, { company: "Acme" }, { position: "Engineer" }] as RemoteOkItem[]) {
      expect(() => remoteOk.normalise(bad)).not.toThrow();
      expect(remoteOk.normalise(bad)).toBeNull();
    }
  });

  it("truncates summary to 400 chars", () => {
    for (const lead of normalised) {
      expect((lead.summary ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX);
    }
  });

  it("never claims a direct contact, because the feed has none", () => {
    // Every row links to an apply page. Treating that as a personal inbox would
    // add 10 points to every lead from this source.
    for (const lead of normalised) {
      expect(lead.isDirect).toBe(false);
      expect(lead.contact).toBeUndefined();
    }
  });

  it("treats a zero salary as unstated, not as unpaid", () => {
    const lead = remoteOk.normalise({
      company: "Acme",
      position: "Backend Engineer",
      salary_min: 0,
      salary_max: 0,
    });
    expect(lead?.payMinUsdHr).toBeUndefined();
    expect(lead?.payRaw).toBeUndefined();
  });

  it("derives an hourly rate from a stated annual figure", () => {
    const lead = remoteOk.normalise({
      company: "Acme",
      position: "Backend Engineer",
      salary_min: 124_800,
    });
    expect(lead?.payMinUsdHr).toBe(60);
  });

  it("leaves scope undefined when the posting does not state one", () => {
    expect(detectScope("", [])).toBeUndefined();
    expect(detectScope("Remote", [])).toBe("worldwide");
    expect(detectScope("Remote (EMEA)", [])).toBe("emea");
    expect(detectScope("Remote - US only", [])).toBe("us");
    expect(detectScope("", ["apac"])).toBe("apac");
  });

  it("strips markup rather than passing HTML downstream", () => {
    expect(stripHtml("<p>Hello <b>world</b></p>")).not.toContain("<");
    expect(stripHtml("a&amp;b")).toBe("a&b");
  });
});
