/**
 * One row per phone number in the work queue.
 *
 * Twelve preschools in Victoria share a single council switchboard. Three RMIT
 * campuses share the university's number. "Vets of Geelong" appears three times
 * on one line. Across 23,203 prospects, 95 rows carry a number that another row
 * already has — and the queue was happy to serve them as twelve separate pieces
 * of work, which is twelve WhatsApp messages to the same council.
 *
 * The reopen window in `outreach-log` guards a *prospect* against being messaged
 * twice. It cannot see this: these are genuinely different businesses, correctly
 * discovered, that happen to answer on one line.
 *
 * So the queue shows the best of each number and drops the rest. Nothing is
 * deleted and nothing is hidden from a search's own page — "who do I message
 * next" is the only question that has to be free of this, and the answer must
 * never be "this number, again".
 *
 * Rows with no phone are never merged: a null is not a number they share.
 */
export function dedupeByPhone<T extends { id: string; phoneE164: string | null }>(
  rows: readonly T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];

  for (const row of rows) {
    // Input order carries the ranking, so the first row for a number is the one
    // worth keeping. Re-sorting here would silently override the caller's order.
    if (row.phoneE164) {
      if (seen.has(row.phoneE164)) continue;
      seen.add(row.phoneE164);
    }
    out.push(row);
  }

  return out;
}
