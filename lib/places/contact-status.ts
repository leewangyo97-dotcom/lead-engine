import { dueAtFor, MAX_STEP } from "../followups";

/**
 * The latest contact with a prospect, as the table shows it.
 *
 * Pure and safe in the browser: the row reads it, and so does the copied-email
 * panel. Before 13 Oct the table knew only *whether* a prospect had been
 * contacted. So after a reload, a row that had been marked sent offered "I sent
 * it" again as if nothing had happened.
 */
export interface LastContact {
  /** The rung: 0 is the first message, 1 and 2 the follow-ups. */
  step: number;
  channel: string;
  /** When it was marked sent (ISO), or null while it waits for "I sent it". */
  sentAt: string | null;
  /** When the next follow-up falls due (ISO), or null when there is none. */
  nextDueAt: string | null;
}

/** A contact row as stored, reduced to what the table needs. */
export function toLastContact(row: { step: number; channel: string; sentAt: Date | null }): LastContact {
  return {
    step: row.step,
    channel: row.channel,
    sentAt: row.sentAt?.toISOString() ?? null,
    nextDueAt:
      row.sentAt && row.step < MAX_STEP ? dueAtFor(row.sentAt, row.step + 1).toISOString() : null,
  };
}

// In Joshua's time zone, fixed, so the server and the browser print the same day.
// The locale's own zone would make a 1 a.m. send read as the day before on Vercel.
const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Manila",
});

/** "13 Oct". */
export function dayLabel(iso: string): string {
  return DAY.format(new Date(iso));
}

/** What the row says about its latest contact, or null when there has been none. */
export function contactStatus(
  last: LastContact | null,
  /**
   * False when nothing can carry a follow-up: do-not-contact, a public body, or
   * a bounced email with no WhatsApp. A due date there would promise a message
   * that will never go (Alyangula, 14 Oct).
   */
  canFollowUp = true,
): { sent: boolean; text: string } | null {
  if (!last) return null;
  const what =
    last.step === 0 ? (last.channel === "whatsapp" ? "WhatsApp" : "Email") : `Follow-up ${last.step}`;
  if (!last.sentAt) return { sent: false, text: `${what} not marked sent yet` };
  const next = !canFollowUp
    ? " · no follow-ups"
    : last.nextDueAt
      ? ` · follow-up due ${dayLabel(last.nextDueAt)}`
      : " · sequence finished";
  return { sent: true, text: `✓ ${what} sent ${dayLabel(last.sentAt)}${next}` };
}
