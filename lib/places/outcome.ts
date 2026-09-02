import type { prospects } from "../db/schema";

/**
 * What a person can record about a message that went out.
 *
 * A prospect has no events table behind it, so its status is the whole record.
 * "reopen" exists because a mistaken click should not silently end a
 * conversation — every outcome here can be taken back.
 */
export const PROSPECT_OUTCOMES = {
  replied: "replied",
  won: "won",
  lost: "lost",
  reopen: "contacted",
} as const satisfies Record<string, (typeof prospects.$inferSelect)["status"]>;

export type ProspectOutcome = keyof typeof PROSPECT_OUTCOMES;

export function isProspectOutcome(value: unknown): value is ProspectOutcome {
  return typeof value === "string" && value in PROSPECT_OUTCOMES;
}

/** Statuses that mean the message got an answer, whatever the answer was. */
export function isAnswered(status: string): boolean {
  return status === "replied" || status === "won" || status === "lost";
}
