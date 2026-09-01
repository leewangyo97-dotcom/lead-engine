/**
 * Retention policy, kept in a module rather than in the script so that reading
 * the policy does not run it. Importing `scripts/retention.ts` executes its
 * `main()` — a test that imported it for the constants would delete rows from
 * whatever database the environment pointed at.
 *
 * Only dead statuses are prunable. Anything drafted, in Gmail, answered or won
 * is kept regardless of age: scores, outreach and events cascade from leads, so
 * deleting one takes the outcome history the Phase 6 learning loop is built on,
 * and none of it is reconstructible.
 */
export const PRUNE_STATUSES = ["disqualified", "parked", "closed"] as const;
export const RETAIN_DAYS = 45;
