import { describe, expect, it } from "vitest";
import { recordedOutcome } from "./outcome-status";

describe("recordedOutcome", () => {
  // 8 Oct: three sends recorded while the page showed nothing at all.
  it("says a send was recorded, and that the follow-up clock is running", () => {
    expect(recordedOutcome("sent")).toEqual({
      text: "sent — the follow-up clock is running",
      pressed: "sent",
    });
  });

  it("marks the one button that set the status", () => {
    expect(recordedOutcome("won")?.pressed).toBe("won");
    expect(recordedOutcome("lost")?.pressed).toBe("lost");
    expect(recordedOutcome("closed")?.pressed).toBe("no_reply");
  });

  it("marks no button when two could have set it", () => {
    // `answered` comes from "Replied" or "Call booked"; guessing would be wrong half the time.
    expect(recordedOutcome("answered")).toEqual({ text: "they answered", pressed: null });
  });

  it("says nothing for a lead no outcome button has touched", () => {
    for (const status of ["needs_scoring", "needs_draft", "drafted", "in_gmail", "parked"]) {
      expect(recordedOutcome(status)).toBeNull();
    }
  });
});
