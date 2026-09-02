import { eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { prospects, searches } from "../db/schema";
import { geocode } from "./nominatim";
import { overpassProvider } from "./overpass";
import { normalizeName, rootDomain } from "./normalize";
import { toE164 } from "./phone";
import { isPlaceCategory, type PlaceCategory } from "./osm-categories";
import type { RawPlace } from "./types";

export interface SearchProgress {
  found: number;
  inserted: number;
  duplicates: number;
}

/**
 * Runs one queued search to completion.
 *
 * The queue is the `searches.status` column and the worker is a script. That is
 * the smallest thing that fits: this project already runs its long work as
 * scripts under GitHub Actions, and a country-wide Overpass query takes minutes,
 * which no serverless request will sit through. Adding a queue dependency to
 * hold one row of state would be worse than the column.
 */
export async function runSearch(searchId: string): Promise<SearchProgress> {
  const db = getDb();

  const [search] = await db.select().from(searches).where(eq(searches.id, searchId)).limit(1);
  if (!search) throw new Error(`no search ${searchId}`);

  const categories = search.categories.filter(isPlaceCategory) as PlaceCategory[];
  if (!categories.length) throw new Error("search has no valid categories");

  try {
    await db
      .update(searches)
      .set({ status: "discovering" })
      .where(eq(searches.id, searchId));

    const place = await geocode(search.query);
    if (!place) throw new Error(`could not geocode "${search.query}"`);

    await db
      .update(searches)
      .set({
        resolvedName: place.displayName,
        lat: place.lat,
        lon: place.lon,
        countryCode: place.countryCode,
        osmId: place.osmId,
        isArea: place.isArea,
      })
      .where(eq(searches.id, searchId));

    const raw = place.isArea
      ? await overpassProvider.searchArea!({ osmId: place.osmId, categories })
      : await overpassProvider.search({
          lat: place.lat,
          lon: place.lon,
          radiusM: search.radiusM ?? 15_000,
          categories,
        });

    const inserted = await persist(searchId, place.countryCode ?? null, raw);

    await db
      .update(searches)
      .set({ status: "complete", completedAt: new Date() })
      .where(eq(searches.id, searchId));

    return { found: raw.length, inserted, duplicates: raw.length - inserted };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(searches)
      .set({ status: "failed", error: message.slice(0, 500), completedAt: new Date() })
      .where(eq(searches.id, searchId));
    throw err;
  }
}

/**
 * Writes discovered places, skipping anything already known.
 *
 * `addressLine` is stored as an empty string rather than null when unknown.
 * Postgres treats NULLs as distinct in a unique index, so a null address would
 * make every unaddressed clinic unique and defeat the cross-search dedupe
 * entirely — the exact case this index exists for.
 */
async function persist(
  searchId: string,
  countryCode: string | null,
  places: RawPlace[],
): Promise<number> {
  if (!places.length) return 0;
  const db = getDb();

  const rows = places.map((p) => ({
    searchId,
    sourceId: p.sourceId,
    sourceProvider: p.sourceProvider,
    name: p.name,
    normalizedName: normalizeName(p.name),
    category: p.category,
    website: p.website ?? null,
    rootDomain: rootDomain(p.website),
    addressLine: p.addressLine ?? "",
    city: p.city ?? null,
    countryCode,
    lat: p.lat,
    lon: p.lon,
    email: p.email ?? null,
    emailConfidence: p.email ? ("osm" as const) : null,
    // Normalised here, not stored raw: the column is called phoneE164 and the
    // WhatsApp link acts on it directly.
    phoneE164: toE164(p.phone, countryCode),
    whatsappE164: toE164(p.whatsapp, countryCode),
    facebookUrl: p.facebook ?? null,
    enrichmentStatus: (p.website ? "pending" : "no_website") as "pending" | "no_website",
  }));

  // A place with no name normalises to an empty string, which would collide
  // with every other such place. toRawPlace already drops those, but a bad
  // upstream change should not silently merge unrelated businesses.
  const usable = rows.filter((r) => r.normalizedName.length > 0);

  // Two unique indexes guard this table, so the conflict target is left open:
  // a row may clash on (searchId, sourceId) or on cross-search identity.
  const result = await db.insert(prospects).values(usable).onConflictDoNothing().returning({
    id: prospects.id,
  });

  return result.length;
}

export async function countProspects(searchId: string): Promise<number> {
  const rows = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(prospects)
    .where(eq(prospects.searchId, searchId));
  return rows[0]?.n ?? 0;
}
