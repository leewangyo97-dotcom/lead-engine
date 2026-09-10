import { PLACE_CATEGORIES, isPlaceCategory, type PlaceCategory } from "./osm-categories";

/**
 * What the work queue is narrowed to, parsed from the URL.
 *
 * The queue crossed two countries and fourteen categories the day a
 * country-wide search landed: 5,162 schools sitting above 1,206 clinics, and no
 * way to say "only Cebu" or "not schools" without picking a whole search. The
 * filter is in the URL rather than in component state so a narrowed queue can be
 * bookmarked and reloaded — working the same slice over several days is the
 * normal case.
 *
 * Parsing is strict about the category because it reaches a SQL comparison: an
 * unknown value is dropped rather than passed through, which also means a
 * mistyped link shows the whole queue instead of an empty page with no
 * explanation. The city is free text — OpenStreetMap's locality names are not a
 * closed set — so it is trimmed and length-capped and nothing more.
 */
export interface QueueFilter {
  city?: string;
  category?: PlaceCategory;
}

/** Longer than any real locality; a guard against a pathological query string. */
const MAX_CITY = 80;

export function parseQueueFilter(params: {
  city?: string | string[];
  category?: string | string[];
}): QueueFilter {
  const filter: QueueFilter = {};

  const city = first(params.city)?.trim();
  if (city && city.length <= MAX_CITY) filter.city = city;

  const category = first(params.category)?.trim();
  if (category && isPlaceCategory(category)) filter.category = category;

  return filter;
}

/** A repeated query parameter arrives as an array; the first one wins. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function isFiltered(filter: QueueFilter): boolean {
  return Boolean(filter.city || filter.category);
}

/**
 * The query string for a filter, so links are built in one place.
 *
 * Clicking the chip that is already active clears it, which is what makes the
 * chips a toggle rather than a one-way door.
 */
export function filterHref(
  base: string,
  current: QueueFilter,
  change: Partial<QueueFilter>,
): string {
  const next: QueueFilter = { ...current, ...change };

  const params = new URLSearchParams();
  if (next.city) params.set("city", next.city);
  if (next.category) params.set("category", next.category);

  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

/** Turns `medicalSpecialists` into `Medical specialists` for a chip. */
export function categoryLabel(category: string): string {
  const spaced = category.replace(/([A-Z])/g, " $1").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export { PLACE_CATEGORIES };
