import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { prospects } from "../db/schema";
import { fetchByIds } from "./overpass";
import { runEnrichment } from "./enrich";
import { toE164 } from "./phone";
import { normalizeName, rootDomain } from "./normalize";
import { isPlaceCategory, type PlaceCategory } from "./osm-categories";
import type { RawPlace } from "./types";

/**
 * Re-reading a prospect from OpenStreetMap without losing hand corrections.
 *
 * The whole difficulty is the second half. A refresh that overwrites the number
 * someone fixed by hand is worse than no refresh at all: the correction survives
 * until the next run and then vanishes, and the person who made it stops
 * trusting the button. So edits are stored separately in `manualOverrides` and
 * re-applied over the scraped values every single time, which makes a hand edit
 * permanent by construction rather than by luck.
 */

/** Fields a person may correct by hand. Anything else is derived or internal. */
export const OVERRIDABLE = [
  "name",
  "website",
  "email",
  "phoneE164",
  "whatsappE164",
  "contactName",
  "city",
  "addressLine",
  "facebookUrl",
  "instagramUrl",
  "linkedinUrl",
] as const;

export type OverridableField = (typeof OVERRIDABLE)[number];

export function isOverridable(field: string): field is OverridableField {
  return (OVERRIDABLE as readonly string[]).includes(field);
}

export type Overrides = Partial<Record<OverridableField, string | null>>;

/**
 * Overrides win over everything, including a null — clearing a wrong phone
 * number by hand has to survive a refresh that would otherwise put it back.
 */
export function applyOverrides<T extends Record<string, unknown>>(
  values: T,
  overrides: Record<string, unknown> | null | undefined,
): T {
  if (!overrides) return values;
  const out = { ...values };
  for (const [field, value] of Object.entries(overrides)) {
    if (isOverridable(field)) (out as Record<string, unknown>)[field] = value;
  }
  return out;
}

export type RefreshOutcome = "updated" | "unchanged" | "missing";

export interface RefreshResult {
  id: string;
  outcome: RefreshOutcome;
  /** Field names that actually changed, for showing what a refresh did. */
  changed: string[];
}

export interface RefreshProgress {
  considered: number;
  updated: number;
  unchanged: number;
  missing: number;
  results: RefreshResult[];
}

type ProspectRow = typeof prospects.$inferSelect;

/**
 * The values a refresh would write, before overrides are applied.
 *
 * OpenStreetMap wins for the facts it holds — a name, an address, a website are
 * maintained there by people who know the business. It does not win by being
 * empty: a missing tag means nobody has filled it in, not that the phone number
 * we already have is wrong.
 */
export function mergeFromOsm(row: ProspectRow, place: RawPlace) {
  const website = place.website ?? row.website;
  return {
    name: place.name,
    normalizedName: normalizeName(place.name),
    category: place.category,
    website,
    rootDomain: website ? rootDomain(website) : row.rootDomain,
    addressLine: place.addressLine ?? row.addressLine,
    city: place.city ?? row.city,
    lat: place.lat,
    lon: place.lon,
    email: place.email ?? row.email,
    phoneE164: toE164(place.phone, row.countryCode) ?? row.phoneE164,
    whatsappE164: toE164(place.whatsapp, row.countryCode) ?? row.whatsappE164,
    facebookUrl: place.facebook ?? row.facebookUrl,
    instagramUrl: row.instagramUrl,
    linkedinUrl: row.linkedinUrl,
    contactName: row.contactName,
  };
}

/** Which of the merged values differ from what is stored. */
export function changedFields(row: ProspectRow, next: Record<string, unknown>): string[] {
  return Object.keys(next).filter((k) => {
    const before = (row as Record<string, unknown>)[k];
    const after = next[k];
    // Both nullish counts as equal: null and undefined are the same absence.
    if (before == null && after == null) return false;
    return before !== after;
  });
}

export interface RefreshOptions {
  searchId?: string;
  ids?: string[];
  limit?: number;
  /** Re-visit websites after the map refresh. Off for bulk, on for one row. */
  enrich?: boolean;
  now?: () => Date;
  fetchPlaces?: typeof fetchByIds;
}

export async function refreshProspects(options: RefreshOptions = {}): Promise<RefreshProgress> {
  const db = getDb();
  const now = options.now ?? (() => new Date());
  const fetchPlaces = options.fetchPlaces ?? fetchByIds;

  const where = options.ids?.length
    ? inArray(prospects.id, options.ids)
    : options.searchId
      ? eq(prospects.searchId, options.searchId)
      : undefined;

  const rows = await db
    .select()
    .from(prospects)
    .where(where)
    .limit(options.limit ?? 200);

  const progress: RefreshProgress = {
    considered: rows.length,
    updated: 0,
    unchanged: 0,
    missing: 0,
    results: [],
  };
  if (rows.length === 0) return progress;

  // One Overpass request for the whole batch. Asking per row would be a request
  // per prospect against a free endpoint that rate limits, for the same answer.
  const categories = [...new Set(rows.map((r) => r.category))].filter(
    isPlaceCategory,
  ) as PlaceCategory[];
  const found = await fetchPlaces(
    rows.map((r) => r.sourceId),
    categories,
  );

  for (const row of rows) {
    const place = found.get(row.sourceId);

    if (!place) {
      // Gone from the map, or no longer tagged as this kind of business. The row
      // stays: a clinic that closed is still worth remembering as one we saw.
      await db
        .update(prospects)
        .set({ lastRefreshedAt: now(), updatedAt: now() })
        .where(eq(prospects.id, row.id));
      progress.missing++;
      progress.results.push({ id: row.id, outcome: "missing", changed: [] });
      continue;
    }

    const merged = applyOverrides(mergeFromOsm(row, place), row.manualOverrides);
    const changed = changedFields(row, merged);

    await db
      .update(prospects)
      .set({ ...merged, lastRefreshedAt: now(), updatedAt: now() })
      .where(eq(prospects.id, row.id));

    if (changed.length > 0) progress.updated++;
    else progress.unchanged++;
    progress.results.push({
      id: row.id,
      outcome: changed.length > 0 ? "updated" : "unchanged",
      changed,
    });
  }

  if (options.enrich) {
    // Enrichment only revisits rows still marked pending, so a refresh that is
    // meant to re-read a website has to say so by resetting the status.
    const ids = rows.filter((r) => r.website).map((r) => r.id);
    if (ids.length > 0) {
      await db
        .update(prospects)
        .set({ enrichmentStatus: "pending" })
        .where(inArray(prospects.id, ids));
      await runEnrichment({ searchId: options.searchId, limit: ids.length });
      await reapplyOverrides(ids);
    }
  }

  return progress;
}

/**
 * Puts hand edits back on top after anything else has written to the row.
 *
 * Enrichment writes directly and knows nothing about overrides, so this runs
 * after it. Keeping the re-application in one function means there is a single
 * place to check that the rule still holds.
 */
export async function reapplyOverrides(ids: string[]): Promise<number> {
  const db = getDb();
  if (ids.length === 0) return 0;

  const rows = await db.select().from(prospects).where(inArray(prospects.id, ids));
  let touched = 0;

  for (const row of rows) {
    if (!row.manualOverrides || Object.keys(row.manualOverrides).length === 0) continue;
    const patch = applyOverrides({} as Record<string, unknown>, row.manualOverrides);
    if (Object.keys(patch).length === 0) continue;
    await db.update(prospects).set(patch).where(eq(prospects.id, row.id));
    touched++;
  }

  return touched;
}

/**
 * Records a hand edit and applies it now.
 *
 * The value is written to the column so the UI shows it immediately, and to
 * `manualOverrides` so the next refresh does not undo it. Both, or the edit is
 * either invisible or temporary.
 */
export async function setOverrides(
  prospectId: string,
  edits: Overrides,
  now: () => Date = () => new Date(),
): Promise<Record<string, unknown> | null> {
  const db = getDb();

  const [row] = await db
    .select({ overrides: prospects.manualOverrides })
    .from(prospects)
    .where(eq(prospects.id, prospectId))
    .limit(1);
  if (!row) return null;

  const next: Record<string, unknown> = { ...(row.overrides ?? {}) };
  for (const [field, value] of Object.entries(edits)) {
    if (!isOverridable(field)) continue;
    // An empty string means "clear this", which is a real correction and has to
    // be stored as null rather than dropped — otherwise the scraped value
    // returns at the next refresh.
    const clean = typeof value === "string" ? value.trim() : value;
    next[field] = clean === "" ? null : clean;
  }

  await db
    .update(prospects)
    .set({ ...applyOverrides({} as Record<string, unknown>, next), manualOverrides: next, updatedAt: now() })
    .where(eq(prospects.id, prospectId));

  return next;
}

/** Drops one hand edit, letting the next refresh restore the scraped value. */
export async function clearOverride(prospectId: string, field: OverridableField): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({ overrides: prospects.manualOverrides })
    .from(prospects)
    .where(and(eq(prospects.id, prospectId)))
    .limit(1);
  if (!row?.overrides) return;

  const next = { ...row.overrides };
  delete next[field];
  await db.update(prospects).set({ manualOverrides: next }).where(eq(prospects.id, prospectId));
}
