import { describe, expect, it } from "vitest";
import { waitingItems } from "./today";

const SET = { GOOGLE_REFRESH_TOKEN: "x", GITHUB_DISPATCH_TOKEN: "y" };

describe("waitingItems", () => {
  it("lists what is waiting, most pressing first, each with where to act", () => {
    const items = waitingItems({ followupsDue: 25, awaitingAnswer: 63, openedNotSent: 3 }, SET);
    expect(items.map((i) => [i.key, i.count, i.href])).toEqual([
      ["followups", 25, "/followups"],
      ["unsent", 3, "/replies#unsent"],
      ["answers", 63, "/replies"],
    ]);
    expect(items[0].text).toBe("follow-ups due");
  });

  it("says nothing about a queue that is empty", () => {
    expect(waitingItems({ followupsDue: 0, awaitingAnswer: 0, openedNotSent: 0 }, SET)).toEqual([]);
  });

  it("speaks in the singular for one", () => {
    expect(waitingItems({ followupsDue: 1, awaitingAnswer: 0, openedNotSent: 0 }, SET)[0].text).toBe(
      "follow-up due",
    );
  });

  it("names missing setup, without a count", () => {
    const items = waitingItems({ followupsDue: 0, awaitingAnswer: 0, openedNotSent: 0 }, {});
    expect(items.map((i) => [i.key, i.count])).toEqual([
      ["gmail", 0],
      ["dispatch", 0],
    ]);
  });
});
