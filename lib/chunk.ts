/**
 * Splits a list into batches, for writes that cannot be one statement.
 *
 * A whole-country search returns tens of thousands of places, and inserting
 * them in a single statement fails twice over. Drizzle builds SQL by merging
 * query fragments recursively, so a large enough `values()` overflows the call
 * stack before a query is ever sent — `RangeError: Maximum call stack size
 * exceeded`, thrown from inside the ORM with nothing in the message about rows.
 * And Postgres caps a statement at 65,535 bind parameters, which the prospects
 * table reaches at roughly three thousand rows.
 *
 * 500 is well under both and keeps the number of round trips sane: the Neon HTTP
 * driver is one request per statement, so the batch size is also the cost.
 */
export const INSERT_BATCH = 500;

export function chunk<T>(items: readonly T[], size = INSERT_BATCH): T[][] {
  if (size < 1) throw new Error(`chunk size must be at least 1, got ${size}`);

  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
