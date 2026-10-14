import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { prospects, suppressions } from "../db/schema";

/**
 * Email addresses that bounced, kept in `suppressions` under their own kind.
 *
 * A bounce is not a "no". The address is dead, but the business may still be
 * reachable by phone or WhatsApp, so a bounce blocks that one address on the
 * email channel and nothing else. `findSuppression`, which blocks every
 * channel, skips this kind for exactly that reason. Keyed by the address
 * itself, a refresh that finds the same dead address again does not revive it,
 * and a new address found later is not blocked.
 *
 * Asked for on 14 Oct, after three bounces in one morning: Angurugu, Grace
 * Podiatry and Alyangula, every one an address from the map listing.
 */
export const BOUNCED = "bounced";

const key = (email: string) => email.trim().toLowerCase();

/** The addresses among `emails` that have bounced. */
export async function bouncedSet(emails: (string | null | undefined)[]): Promise<Set<string>> {
  const values = [...new Set(emails.filter((e): e is string => !!e).map(key))];
  if (values.length === 0) return new Set();
  const rows = await getDb()
    .select({ value: suppressions.value })
    .from(suppressions)
    .where(and(eq(suppressions.kind, BOUNCED), inArray(suppressions.value, values)));
  return new Set(rows.map((r) => r.value));
}

/** Every bounced address, for scoring the whole table at once. */
export async function allBounced(): Promise<Set<string>> {
  const rows = await getDb()
    .select({ value: suppressions.value })
    .from(suppressions)
    .where(eq(suppressions.kind, BOUNCED));
  return new Set(rows.map((r) => r.value));
}

export function isBouncedIn(set: Set<string>, email: string | null | undefined): boolean {
  return !!email && set.has(key(email));
}

/** Marks the prospect's current address as bounced, or undoes that. */
export async function setBounced(
  prospectId: string,
  bounced: boolean,
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const db = getDb();
  const [place] = await db
    .select({ email: prospects.email })
    .from(prospects)
    .where(eq(prospects.id, prospectId))
    .limit(1);
  if (!place) return { ok: false, error: "no such prospect" };
  if (!place.email) return { ok: false, error: "no email address on file" };

  if (bounced) {
    await db
      .insert(suppressions)
      .values({ kind: BOUNCED, value: key(place.email), reason: "the address bounced" })
      .onConflictDoNothing();
  } else {
    await db
      .delete(suppressions)
      .where(and(eq(suppressions.kind, BOUNCED), eq(suppressions.value, key(place.email))));
  }
  return { ok: true, email: place.email };
}
