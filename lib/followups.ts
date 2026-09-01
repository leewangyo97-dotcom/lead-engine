/**
 * The follow-up ladder. Most replies come from the second touch and almost
 * nobody sends it, which makes this the highest ratio of value to effort in the
 * project.
 *
 * Two touches after the first, then stop. A third is noise, and the point of a
 * ladder with an end is that it cannot turn into pestering by inattention.
 */
export const LADDER_DAYS = [4, 11] as const;
export const MAX_STEP = LADDER_DAYS.length; // step 0 is the first touch

/** Outcomes that cancel the ladder. Any human response ends the sequence. */
export const REPLIED_TYPES = ["reply", "call", "won", "lost"] as const;

export function dueAtFor(sentAt: Date, step: number): Date {
  const days = LADDER_DAYS[step - 1];
  if (days == null) throw new Error(`no ladder rung for step ${step}`);
  return new Date(sentAt.getTime() + days * 86_400_000);
}

/**
 * Whether a follow-up is owed right now.
 *
 * Measured from the *last* touch rather than the first: if a day-4 note went out
 * late, the day-11 one should not arrive the next morning.
 */
export function isDue({
  lastSentAt,
  nextStep,
  hasReplied,
  now = new Date(),
}: {
  lastSentAt: Date | null;
  nextStep: number;
  hasReplied: boolean;
  now?: Date;
}): boolean {
  if (hasReplied) return false;
  if (!lastSentAt) return false; // nothing was sent, so nothing is owed
  if (nextStep > MAX_STEP) return false;

  const gap = LADDER_DAYS[nextStep - 1];
  return now.getTime() - lastSentAt.getTime() >= gap * 86_400_000;
}
