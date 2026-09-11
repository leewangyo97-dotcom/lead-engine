import { describe, expect, it } from "vitest";
import { contactOutcome } from "./outreach-log";

/**
 * The rule the Gmail routing exists for.
 *
 * Before it, clicking Email handed the browser a `mailto:` link and stamped
 * `sentAt` in the same breath. The browser says nothing when no mail client is
 * registered, so the message could silently never be written — and the prospect
 * still left the queue and came due for a follow-up four days later referring to
 * a message they had never received.
 */
describe("contactOutcome", () => {
  it("does not call a Gmail draft sent", () => {
    const outcome = contactOutcome("email", true);
    expect(outcome.mode).toBe("gmail-draft");
    expect(outcome.countsAsSent).toBe(false);
  });

  it("counts a mailto: hand-off as sent, because nothing here will ever see it", () => {
    // No draft to track and no event to wait for: the person is about to press
    // send in their own mail client. Recording it is the only honest option.
    const outcome = contactOutcome("email", false);
    expect(outcome.mode).toBe("mailto");
    expect(outcome.countsAsSent).toBe(true);
  });

  it("leaves WhatsApp exactly as it was", () => {
    expect(contactOutcome("whatsapp", false)).toEqual({ mode: "whatsapp", countsAsSent: true });
  });

  it("ignores a stray Gmail draft on a WhatsApp contact", () => {
    // wa.me is a web page; there is no drafting step to have succeeded.
    expect(contactOutcome("whatsapp", true).mode).toBe("whatsapp");
  });
});
