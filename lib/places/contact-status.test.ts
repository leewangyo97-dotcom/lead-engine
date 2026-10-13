import { describe, expect, it } from "vitest";
import { contactStatus, dayLabel, toLastContact } from "./contact-status";

const SENT = new Date("2026-10-13T03:00:00.000Z"); // 11 a.m. in the Philippines

describe("toLastContact", () => {
  it("dates the next follow-up from the send, rung by rung", () => {
    expect(toLastContact({ step: 0, channel: "email", sentAt: SENT }).nextDueAt).toBe(
      "2026-10-17T03:00:00.000Z",
    );
    expect(toLastContact({ step: 1, channel: "email", sentAt: SENT }).nextDueAt).toBe(
      "2026-10-20T03:00:00.000Z",
    );
    expect(toLastContact({ step: 2, channel: "email", sentAt: SENT }).nextDueAt).toBeNull();
  });

  it("has no due date while the send is unconfirmed", () => {
    expect(toLastContact({ step: 0, channel: "email", sentAt: null })).toEqual({
      step: 0,
      channel: "email",
      sentAt: null,
      nextDueAt: null,
    });
  });
});

describe("contactStatus", () => {
  it("says a confirmed send happened, when, and when the follow-up is due", () => {
    expect(contactStatus(toLastContact({ step: 0, channel: "email", sentAt: SENT }))).toEqual({
      sent: true,
      text: "✓ Email sent 13 Oct · follow-up due 17 Oct",
    });
  });

  it("asks for the click while a send is unconfirmed", () => {
    expect(contactStatus(toLastContact({ step: 0, channel: "email", sentAt: null }))).toEqual({
      sent: false,
      text: "Email not marked sent yet",
    });
  });

  it("names follow-ups and the end of the sequence", () => {
    expect(contactStatus(toLastContact({ step: 2, channel: "email", sentAt: SENT }))?.text).toBe(
      "✓ Follow-up 2 sent 13 Oct · sequence finished",
    );
    expect(contactStatus(toLastContact({ step: 0, channel: "whatsapp", sentAt: SENT }))?.text).toMatch(
      /^✓ WhatsApp sent/,
    );
  });

  it("is silent for a prospect never contacted", () => {
    expect(contactStatus(null)).toBeNull();
  });
});

describe("dayLabel", () => {
  it("prints the day in the Philippines, not in the server's zone", () => {
    // 17:30 UTC on the 12th is 01:30 on the 13th in Manila.
    expect(dayLabel("2026-10-12T17:30:00.000Z")).toBe("13 Oct");
  });
});
