/**
 * The contact cooldown's memory: when each company was last actually written to.
 *
 * A draft is not a contact. Keying this on when a draft was *written* started a
 * 90-day silence against a company nobody had sent anything to, which is how a
 * lead can be rejected as "recently_contacted" having never been contacted.
 */
export interface SentRow {
  company: string;
  at: Date | null;
}

export function latestByCompany(rows: SentRow[]): Map<string, Date> {
  const latest = new Map<string, Date>();
  for (const row of rows) {
    // An unsent row carries no date and must not create an entry at all.
    if (!row.at) continue;
    const key = row.company.toLowerCase();
    const prev = latest.get(key);
    if (!prev || row.at > prev) latest.set(key, row.at);
  }
  return latest;
}
