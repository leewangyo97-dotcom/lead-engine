import { MAX_STEP } from "../followups";

/**
 * Whether a draft may be stored at the step it claims.
 *
 * The ladder only means anything if the rungs arrive in order. Storing a day-4
 * nudge as step 0 makes it a second first-email — the outreach log then shows
 * two opening messages to the same company, and `getDueFollowups` reads the
 * highest step as 0 forever, so it keeps asking for step 1 that has already been
 * written.
 */
export interface StepCheck {
  ok: boolean;
  reason?: string;
}

export function checkStep({
  step,
  highestSentStep,
  hasUnsentDraft,
}: {
  step: number;
  /** Highest step already sent for this lead, or null when nothing has been. */
  highestSentStep: number | null;
  /** A draft at this step already exists and has not been sent. */
  hasUnsentDraft: boolean;
}): StepCheck {
  if (step > MAX_STEP) {
    return { ok: false, reason: `step ${step} is past the end of the ladder (max ${MAX_STEP})` };
  }

  if (step === 0) {
    // A first touch after something has already gone out is almost always a
    // mislabelled follow-up, and it would restart the ladder.
    if (highestSentStep !== null) {
      return {
        ok: false,
        reason: `step 0 but step ${highestSentStep} has already been sent — a follow-up is step ${highestSentStep + 1}`,
      };
    }
    return { ok: true };
  }

  if (highestSentStep === null) {
    return { ok: false, reason: `step ${step} but nothing has been sent yet` };
  }

  const expected = highestSentStep + 1;
  if (step !== expected) {
    return { ok: false, reason: `step ${step} but the next rung is ${expected}` };
  }

  if (hasUnsentDraft) {
    return { ok: false, reason: `a step ${step} draft is already written and unsent` };
  }

  return { ok: true };
}
