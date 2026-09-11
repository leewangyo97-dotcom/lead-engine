import { readFileSync } from "node:fs";
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

  it("does not call a mailto: hand-off sent either", () => {
    // This used to record a send, on the grounds that nothing here would ever
    // observe it. That made the fallback a back door to the same bug — and the
    // refresh token expires weekly while the consent screen is in Testing, so
    // the fallback is not an edge case, it is next week.
    const outcome = contactOutcome("email", false);
    expect(outcome.mode).toBe("mailto");
    expect(outcome.countsAsSent).toBe(false);
  });

  it("never counts an email as sent, by either route", () => {
    // The property, stated once: no email path may claim a send on a click.
    for (const drafted of [true, false]) {
      expect(contactOutcome("email", drafted).countsAsSent).toBe(false);
    }
  });

  it("leaves WhatsApp exactly as it was", () => {
    expect(contactOutcome("whatsapp", false)).toEqual({ mode: "whatsapp", countsAsSent: true });
  });

  it("ignores a stray Gmail draft on a WhatsApp contact", () => {
    // wa.me is a web page; there is no drafting step to have succeeded.
    expect(contactOutcome("whatsapp", true).mode).toBe("whatsapp");
  });
});

describe("markProspectSent only looks at real contacts", () => {
  const SOURCE = readFileSync("lib/places/outreach-log.ts", "utf8");
  const query = SOURCE.slice(SOURCE.indexOf("export async function markProspectSent"));

  it("filters on step, because an unsent draft looks identical without it", () => {
    // The seventeen enhanced messages waiting for review are prospect outreach
    // rows at DRAFT_STEP (-1) with a null sentAt. On prospectId and sentAt alone
    // they are indistinguishable from a contact awaiting confirmation, and
    // matching one marked "Enhanced message for Otaku-Yaki Restaurant" as sent —
    // a message nobody had opened.
    expect(query).toMatch(/gte\(outreach\.step, 0\)/);
  });

  it("still requires the row to be unsent, so one send cannot be counted twice", () => {
    expect(query).toMatch(/isNull\(outreach\.sentAt\)/);
  });
});
