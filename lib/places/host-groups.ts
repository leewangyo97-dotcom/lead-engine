/**
 * Splitting an enrichment queue into per-host runs.
 *
 * Enrichment is a sequential loop with a one-second pause between requests, and
 * it enriches 25 rows a night. Against 9,100 pending rows that is 364 nights —
 * the backlog is not a fetching problem, it is a concurrency problem.
 *
 * Concurrency cannot simply be switched on, because the pause is owed to the
 * *host*, not to the queue. Most rows are different businesses on different
 * domains and could safely be fetched at the same time, but not all: Easy
 * Solutions Plumbing Sydney and Easy Solutions Plumbing North Shore are two rows
 * on one website, and hitting it twice at once is exactly the thing the pause
 * exists to prevent.
 *
 * So rows are grouped by hostname. Groups run in parallel; a group runs in
 * order, one request at a time, keeping every host's pacing intact.
 */
export interface HostAddressable {
  website: string | null;
}

/** Lowercased hostname, `www.` dropped so one site is one group. */
export function hostOf(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    return new URL(website).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function groupByHost<T extends HostAddressable>(rows: readonly T[]): T[][] {
  const groups = new Map<string, T[]>();
  const ungrouped: T[][] = [];

  for (const row of rows) {
    const host = hostOf(row.website);
    if (!host) {
      // No usable URL means no host to be polite to, and no reason to make it
      // wait behind an unrelated row. Each becomes its own group.
      ungrouped.push([row]);
      continue;
    }
    const existing = groups.get(host);
    if (existing) existing.push(row);
    else groups.set(host, [row]);
  }

  return [...groups.values(), ...ungrouped];
}
