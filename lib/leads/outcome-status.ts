/**
 * What a lead's status says has been recorded, in words.
 *
 * The outcome buttons gave no sign of either. Pressing "I sent it" on 8 Oct
 * recorded the send correctly — status `sent`, `sentAt` stamped, one event —
 * and the page looked exactly as it had before, because the only thing that
 * changed was the status pill at the top, scrolled out of view. Three sends
 * were recorded while the person pressing believed none had been.
 *
 * `pressed` names the button that produced the status, when exactly one could
 * have: `answered` comes from either "Replied" or "Call booked", so it marks
 * neither rather than guessing.
 */
export type RecordedOutcome = {
  text: string;
  pressed: "sent" | "won" | "lost" | "no_reply" | null;
};

const RECORDED: Record<string, RecordedOutcome> = {
  sent: { text: "sent — the follow-up clock is running", pressed: "sent" },
  answered: { text: "they answered", pressed: null },
  won: { text: "won", pressed: "won" },
  lost: { text: "lost", pressed: "lost" },
  closed: { text: "closed with no reply", pressed: "no_reply" },
};

/** Null for every status no outcome button sets — nothing has been recorded yet. */
export function recordedOutcome(status: string): RecordedOutcome | null {
  return RECORDED[status] ?? null;
}
