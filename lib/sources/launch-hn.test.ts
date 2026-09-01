import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/launch-hn.json";
import { extractStackFromBuildContext, launchHn, type LaunchHnStory } from "./launch-hn";
import { contentHash } from "./hash";
import { SUMMARY_MAX } from "./types";

const stories = fixture.hits as LaunchHnStory[];
const normalised = stories.map((s) => launchHn.normalise(s)).filter((l) => l !== null);

describe("launch-hn", () => {
  it("normalises a real fixture into founder leads", () => {
    expect(normalised.length).toBe(stories.length);
    for (const lead of normalised) {
      expect(lead.kind).toBe("funding");
      expect(lead.company).toBeTruthy();
      expect(lead.title.startsWith("Founder")).toBe(true);
      expect(lead.triggerEvent).toMatch(/launched on HN \d+d ago/);
    }
  });

  it("strips the YC batch from the company name and keeps it in the trigger", () => {
    // "Launch HN: Almanac (YC S26) - AI that ..." is a company called Almanac.
    const lead = launchHn.normalise({
      objectID: "1",
      author: "someone",
      title: "Launch HN: Almanac (YC S26) – AI that knows your company",
      created_at: new Date().toISOString(),
      story_text: "Hi HN, we built this with TypeScript. Reach me at a@almanac.com",
    });
    expect(lead?.company).toBe("Almanac");
    expect(lead?.triggerEvent).toContain("YC S26");
    expect(lead?.contact).toBe("a@almanac.com");
    expect(lead?.isDirect).toBe(true);
  });

  it("never invents a region or contract terms", () => {
    // A launch post states neither, and guessing would put a fabricated fact
    // into the highest-weighted scoring input.
    for (const lead of normalised) {
      expect(lead.region).toBeUndefined();
      expect(lead.remoteScope).toBeUndefined();
      expect(lead.isContract).toBe(false);
    }
  });

  it("returns null for anything that is not a Launch HN post", () => {
    for (const bad of ["Show HN: my thing", "Ask HN: who is hiring?", ""]) {
      expect(
        launchHn.normalise({
          objectID: "1",
          author: "a",
          title: bad,
          created_at: new Date().toISOString(),
          story_text: null,
        }),
      ).toBeNull();
    }
  });

  it("produces a stable contentHash across two runs", () => {
    const a = stories.map((s) => launchHn.normalise(s)).filter((l) => l !== null).map(contentHash);
    const b = stories.map((s) => launchHn.normalise(s)).filter((l) => l !== null).map(contentHash);
    expect(a).toEqual(b);
  });

  it("keeps the hash stable even though the trigger text ages daily", () => {
    // triggerEvent says "launched on HN 3d ago" and changes every morning. It is
    // not part of the hash, or every founder lead would look new every night.
    const lead = normalised[0];
    expect(contentHash({ ...lead, triggerEvent: "launched on HN 99d ago" })).toBe(
      contentHash(lead),
    );
  });

  it("truncates summary to 400 chars", () => {
    for (const lead of normalised) {
      expect((lead.summary ?? "").length).toBeLessThanOrEqual(SUMMARY_MAX);
    }
  });
});

describe("stack extraction from a pitch", () => {
  it("ignores a technology mentioned in passing", () => {
    // machine0 is a GPU VM company. Both words below appear in its post, and
    // scanning the whole text scored it 81 on a stack it does not need.
    expect(
      extractStackFromBuildContext(
        "We give your agent a persistent cloud VM. Great for running TypeScript agents or a Postgres box.",
      ),
    ).toEqual([]);
  });

  it("counts a technology the company says it builds with", () => {
    expect(
      extractStackFromBuildContext("Our app is built with Kotlin and React Native."),
    ).toEqual(["kotlin", "react-native"]);
    expect(extractStackFromBuildContext("The backend uses Node and Postgres.")).toContain("node");
  });
});
