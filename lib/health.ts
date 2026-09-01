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

  // One source returning nothing while others work means that adapter died —
  // a site redesign, a moved endpoint. Distinct from every source returning
  // nothing, which is the outage case handled above, and stated as an absolute
  // rather than a percentage: harvest volume swings legitimately with thread age
  // and feed rotation, so a drop-off threshold would cry wolf.
  const productive = sources.filter((s) => (s.lastRawCount ?? 0) > 0);
  if (productive.length > 0) {
    const silent = sources.filter((s) => s.lastRawCount === 0);
    if (silent.length) {
      faults.push(
        `${silent.length} source(s) returned nothing while others worked: ${silent
          .map((s) => s.id)
          .join(", ")}`,
      );
    }
  }

  const stale = sources.filter(
    (s) => !s.lastRunAt || now.getTime() - s.lastRunAt.getTime() > STALE_HOURS * 3_600_000,
  );
  if (stale.length) {
    faults.push(
      `${stale.length} source(s) have not run in ${STALE_HOURS}h: ${stale.map((s) => s.id).join(", ")}`,
    );
  }

  return faults;
}
