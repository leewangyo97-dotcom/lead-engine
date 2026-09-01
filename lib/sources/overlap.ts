import type { RemoteScope } from "./types";

/**
 * Hours per day a region overlaps Joshua's 09:00-18:00 Manila (UTC+8) window,
 * which is 01:00-10:00 UTC.
 *
 * Derived from the posting's stated scope, never guessed from a company name or
 * a city that happens to appear in the body. A posting that says nothing gets
 * null, not a flattering default — an invented overlap is exactly the kind of
 * fact that ends up in an email.
 */
const OVERLAP_BY_SCOPE: Record<RemoteScope, number> = {
  worldwide: 9, // async by construction; the whole window is workable
  apac: 8,
  emea: 3, // EMEA 09:00-18:00 CET = 08:00-17:00 UTC; overlap is the morning tail
  us: 1, // US Eastern 09:00-18:00 = 14:00-23:00 UTC; almost nothing
  onsite: 0,
};

export function overlapHours(scope: RemoteScope | undefined): number | null {
  if (!scope) return null;
  return OVERLAP_BY_SCOPE[scope];
}
