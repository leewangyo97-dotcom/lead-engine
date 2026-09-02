/**
 * The failure modes that do not announce themselves.
 *
 * A broken adapter throws and gets reported. These two do not: an adapter whose
 * site changed can return an empty list without erroring, and a scheduler that
 * stops simply stops — every source still says "ok", the workflow stays green,
 * no issue is filed, and the pipeline has quietly starved.
 *
 * Kept pure and out of the script so CI can test it without a database. The
 * first version of this lived inside report-run.ts and could only be exercised
 * by seeding a live Neon branch, which is a poor trade for logic this simple.
 */
export const STALE_HOURS = 36;

/** The workflow's own schedule: 20:00 UTC, which is 04:00 in Manila. */
export const SCHEDULE_HOUR_UTC = 20;

/**
 * How late a run may be before it counts as missed.
 *
 * GitHub delays scheduled workflows under load and sometimes drops one — which
 * is how this was found, with no run at all on a Wednesday night. Six hours is
 * long enough not to cry about a delay and short enough that a skipped night is
 * visible the next morning.
 */
export const GRACE_HOURS = 6;

export interface SourceHealth {
  id: string;
  lastRunAt: Date | null;
  lastOk: boolean;
  lastError?: string | null;
  /** Raw items this source returned last run. Null before it has ever run. */
  lastRawCount?: number | null;
}

export interface PipelineState {
  /** rawCount of the most recent run, or null if no run has been recorded. */
  latestRawCount: number | null;
  sources: SourceHealth[];
  now?: Date;
}

/**
 * When the harvest was last due: the schedule in `.github/workflows/nightly.yml`
 * is `0 20 * * 1-5`, so 20:00 UTC on the most recent weekday at or before now.
 */
export function expectedLastRun(now: Date): Date | null {
  const candidate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), SCHEDULE_HOUR_UTC, 0, 0, 0),
  );
  // Before today's slot, the last due run was on a previous day.
  if (candidate > now) candidate.setUTCDate(candidate.getUTCDate() - 1);

  // Walk back over the weekend: Sunday is 0, Saturday is 6.
  for (let i = 0; i < 7; i++) {
    const day = candidate.getUTCDay();
    if (day !== 0 && day !== 6) return candidate;
    candidate.setUTCDate(candidate.getUTCDate() - 1);
  }
  return null;
}

/** Returns one message per fault. Empty means healthy. */
export function pipelineFaults({ latestRawCount, sources, now = new Date() }: PipelineState): string[] {
  const faults: string[] = [];

  const broken = sources.filter((s) => !s.lastOk);
  if (broken.length) {
    faults.push(
      `${broken.length} source(s) failed on the last run: ${broken.map((s) => s.id).join(", ")}`,
    );
  }

  // Zero raw items across every source is never legitimate. Zero *new* items is
  // normal and expected — the content hash means most nights insert nothing.
  if (latestRawCount === 0) {
    faults.push("every source returned zero items — the pipeline has starved, not settled");
  }

  // Measured against the schedule, not against a flat number of hours. The
  // harvest runs weekdays, so Friday evening to Monday evening is seventy-two
  // hours of legitimate silence — a flat 36-hour rule called that a fault every
  // single weekend, which is the red-for-no-reason that teaches you to stop
  // reading these.
  const expected = expectedLastRun(now);
  if (expected && now.getTime() - expected.getTime() > GRACE_HOURS * 3_600_000) {
    const missed = sources.filter((s) => !s.lastRunAt || s.lastRunAt < expected);
    if (missed.length) {
      faults.push(
        `${missed.length} source(s) missed the run due ${expected.toISOString()}: ${missed
          .map((s) => s.id)
          .join(", ")}`,
      );
    }
  }

  return faults;
}

/**
 * Worth saying, not worth failing the run for.
 *
 * A source returning nothing while others work usually means that adapter died.
 * But RemoteOK legitimately yields three or four engineering roles from a
 * hundred items, and zero on a slow day is a real outcome rather than a fault —
 * so failing on it would produce exactly the red-for-no-reason runs that train
 * a person to stop reading them.
 *
 * It is reported every time and escalates to a fault only via a human noticing
 * the same name twice.
 */
export function pipelineWarnings({ sources }: Pick<PipelineState, "sources">): string[] {
  const productive = sources.filter((s) => (s.lastRawCount ?? 0) > 0);
  if (!productive.length) return [];

  const silent = sources.filter((s) => s.lastRawCount === 0);
  if (!silent.length) return [];

  return [
    `${silent.length} source(s) returned nothing while others worked: ${silent
      .map((s) => s.id)
      .join(", ")} — normal for a low-volume feed, a dead adapter if it repeats`,
  ];
}
