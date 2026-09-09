import { leadStatus } from "../db/schema";

/**
 * Which leads `refilter` may re-judge, and which it must never touch.
 *
 * Re-judging a lead that has already been written to would let the filter mark
 * it disqualified after an email went out — the outreach log would then say
 * something untrue about a real conversation. So the protected list is the
 * safety property, and the test beside this file checks that every status is in
 * exactly one of the two lists: a new status added to the enum and forgotten
 * here would otherwise default to neither, or worse, to re-judgeable.
 */
export const PROTECTED = [
  "needs_draft",
  "drafted",
  "in_gmail",
  "sent",
  "answered",
  "won",
  "lost",
  "closed",
] as const;

export const REJUDGEABLE = ["parked", "disqualified", "needs_scoring", "scored"] as const;

/** Every value the enum allows, for the completeness check. */
export const ALL_STATUSES = leadStatus.enumValues;
