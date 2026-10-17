import { fetchJson } from "../sources/fetch-json";
import { OSM_CATEGORIES, type PlaceCategory } from "./osm-categories";
import { OSM_USER_AGENT } from "./nominatim";
import type { PlaceProvider, PlaceSearchInput, RawPlace } from "./types";

/**
 * Public Overpass instances (wiki.openstreetmap.org/wiki/Overpass_API), tried
 * in order: the main one, and a mirror only when it fails, so the load stays
 * where its operators expect it. On 17 Oct two other listed mirrors
 * (kumi.systems, private.coffee) answered 500 to a one-node query.
 */
export const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

/** Overpass area ids are the relation's osm_id offset by this constant. */
const AREA_ID_OFFSET = 3_600_000_000;

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/** Flattens the requested categories into plain [key, value] tag pairs. */
function tagsFor(categories: PlaceCategory[]): [string, string][] {
  return categories.flatMap((c) => OSM_CATEGORIES[c].map(([k, v]) => [k, v] as [string, string]));
}

/**
 * Builds a radius query. The timeout is always explicit — an unbounded query is
 * both against Overpass policy and a good way to have the request killed at an
 * unpredictable point.
 */
export function buildRadiusQuery(input: PlaceSearchInput, timeoutS = 90): string {
  const clauses = tagsFor(input.categories)
    .map(
      ([k, v]) =>
        `  nwr["${k}"="${v}"](around:${Math.round(input.radiusM)},${input.lat},${input.lon});`,
    )
    .join("\n");

  return `[out:json][timeout:${timeoutS}];\n(\n${clauses}\n);\nout center tags;`;
}

export function buildAreaQuery(
  osmId: number,
  categories: PlaceCategory[],
  timeoutS = 180,
): string {
  const clauses = tagsFor(categories)
    .map(([k, v]) => `  nwr["${k}"="${v}"](area.searchArea);`)
    .join("\n");

  return (
    `[out:json][timeout:${timeoutS}];\n` +
    `area(${AREA_ID_OFFSET + osmId})->.searchArea;\n(\n${clauses}\n);\nout center tags qt;`
  );
}

/**
 * A country's own first-level divisions (provinces, states), for a category
 * too big to ask for nationally in one query. The ISO 3166-2 prefix keeps out
 * a neighbour's states, whose borders share nodes with this country's.
 */
export function buildSubAreasQuery(osmId: number, countryCode: string, timeoutS = 90): string {
  return (
    `[out:json][timeout:${timeoutS}];area(${AREA_ID_OFFSET + osmId})->.c;` +
    `rel(area.c)["boundary"="administrative"]["admin_level"="4"]["ISO3166-2"~"^${countryCode.toUpperCase()}-"];out ids;`
  );
}

/** Which requested category an element belongs to, by its tags. */
export function categoryOf(
  tags: Record<string, string>,
  requested: PlaceCategory[],
): PlaceCategory | null {
  for (const category of requested) {
    for (const [k, v] of OSM_CATEGORIES[category]) {
      if (tags[k] === v) return category;
    }
  }
  return null;
}

/**
 * OSM stores the same fact under several keys. `contact:` prefixed tags are the
 * newer convention and win where both exist.
 */
export function toRawPlace(
  el: OverpassElement,
  requested: PlaceCategory[],
): RawPlace | null {
  const tags = el.tags ?? {};
  const name = tags.name?.trim();
  if (!name) return null;

  const category = categoryOf(tags, requested);
  if (!category) return null;

  // `way` and `relation` have no lat/lon of their own; `out center` supplies one.
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat == null || lon == null) return null;

  const address = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");

  return {
    sourceId: `osm:${el.type}/${el.id}`,
    sourceProvider: "overpass",
    name,
    category,
    lat,
    lon,
    website: tags["contact:website"] ?? tags.website,
    phone: tags["contact:phone"] ?? tags.phone,
    email: tags["contact:email"] ?? tags.email,
    whatsapp: tags["contact:whatsapp"],
    facebook: tags["contact:facebook"],
    addressLine: address || undefined,
    city: localityOf(tags),
    postcode: tags["addr:postcode"],
    openingHours: tags.opening_hours,
  };
}

/**
 * The locality a business is in, whatever OpenStreetMap calls it there.
 *
 * `addr:city` is the obvious tag and it is almost never set in Australia: 217 of
 * 20,107 rows, because Australian addresses name a suburb, not a city. Reading
 * only `addr:city` left the city column 97% empty and made it useless to filter
 * or sort by — the data was there under a different key the whole time.
 *
 * Order matters: city first where it exists, then the more local names. A
 * suburb is a better answer than a state, and any of them beats null.
 */
export function localityOf(tags: Record<string, string | undefined>): string | undefined {
  // Each candidate is trimmed before it is judged. `??` alone would let a tag
  // present but blank — `addr:city=" "` — win over a suburb that has a real
  // value, since only null and undefined fall through it.
  for (const key of [
    "addr:city",
    "addr:suburb",
    "addr:town",
    "addr:village",
    "addr:municipality",
    "addr:hamlet",
  ]) {
    const value = tags[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

/**
 * The free Overpass endpoint answers with 429 when rate limited and 504 when its
 * resources are exhausted. Both are transient and both deserve a sentence a
 * person can act on rather than a stack trace.
 */
export function friendlyOverpassError(message: string): string {
  if (/\b429\b/.test(message)) {
    return "The free map service is rate limiting us. Wait a minute and try again.";
  }
  if (/\b504\b/.test(message) || /timeout/i.test(message)) {
    return "The free map service is busy. Try again in a minute, or narrow the search area.";
  }
  return message;
}

/**
 * A 200 that still failed. Overpass reports a query that ran out of time or
 * memory in `remark`, beside whatever it had found by then: taken as success,
 * a search would quietly keep half its results.
 */
export function overpassRemarkError(remark: string | undefined): string | null {
  return remark && /runtime error|timed out|out of memory/i.test(remark) ? remark : null;
}

async function overpassJson(
  query: string,
  timeoutMs: number,
  endpoints: string[] = OVERPASS_ENDPOINTS,
): Promise<{ elements: OverpassElement[] }> {
  let last = "";
  for (const endpoint of endpoints) {
    try {
      const data = await fetchJson<{ elements: OverpassElement[]; remark?: string }>(endpoint, {
        method: "POST",
        body: new URLSearchParams({ data: query }).toString(),
        headers: {
          "User-Agent": OSM_USER_AGENT,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeoutMs,
        attempts: 2,
        // A loaded server needs longer than fetchJson's half second to recover.
        sleep: (ms) => new Promise((r) => setTimeout(r, ms * 20)),
      });
      const failed = overpassRemarkError(data.remark);
      if (failed) throw new Error(`${endpoint}: ${failed}`);
      return data;
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(friendlyOverpassError(last));
}

async function run(query: string, timeoutMs: number, requested: PlaceCategory[]) {
  const data = await overpassJson(query, timeoutMs);
  return data.elements
    .map((el) => toRawPlace(el, requested))
    .filter((p): p is RawPlace => p !== null);
}

async function subAreas(osmId: number, countryCode: string): Promise<number[]> {
  const data = await overpassJson(buildSubAreasQuery(osmId, countryCode), 120_000);
  return data.elements.filter((e) => e.type === "relation").map((e) => e.id);
}

/**
 * Builds a lookup by source id, for refreshing places already known.
 *
 * Refresh cannot reuse the radius query: a business that moved out of the radius
 * or lost the tag that matched the category would come back empty and look
 * deleted. Asking for the element by id says whether it still exists.
 */
export function buildIdQuery(sourceIds: string[], timeoutS = 60): string {
  const byType: Record<string, number[]> = { node: [], way: [], relation: [] };

  for (const sourceId of sourceIds) {
    const m = sourceId.match(/^osm:(node|way|relation)\/(\d+)$/);
    if (m) byType[m[1]].push(Number(m[2]));
  }

  const parts = Object.entries(byType)
    .filter(([, ids]) => ids.length > 0)
    .map(([type, ids]) => `${type}(id:${ids.join(",")});`);

  return `[out:json][timeout:${timeoutS}];(${parts.join("")});out center tags;`;
}

/**
 * Re-reads known places from OpenStreetMap, keyed by source id.
 *
 * An id absent from the result is absent from the map — either deleted or no
 * longer tagged as this kind of business. Both are facts worth showing rather
 * than errors.
 */
export async function fetchByIds(
  sourceIds: string[],
  categories: PlaceCategory[],
): Promise<Map<string, RawPlace>> {
  if (sourceIds.length === 0) return new Map();
  const places = await run(buildIdQuery(sourceIds), 60_000, categories);
  return new Map(places.map((p) => [p.sourceId, p]));
}

export const overpassProvider: PlaceProvider = {
  name: "overpass",

  async search(input: PlaceSearchInput): Promise<RawPlace[]> {
    return run(buildRadiusQuery(input), 100_000, input.categories);
  },

  async searchArea({ osmId, categories, countryCode }): Promise<RawPlace[]> {
    // A country-wide query genuinely takes minutes; the client timeout has to
    // exceed the [timeout:180] in the query or we abort work Overpass is doing.
    try {
      return await run(buildAreaQuery(osmId, categories), 200_000, categories);
    } catch (err) {
      // Too big as one query even after the mirror: the same search one
      // province or state at a time, deduplicated where borders overlap.
      if (!countryCode) throw err;
      const parts = await subAreas(osmId, countryCode).catch(() => []);
      if (parts.length < 2) throw err;
      const found = new Map<string, RawPlace>();
      for (const part of parts) {
        for (const place of await run(buildAreaQuery(part, categories), 200_000, categories)) {
          found.set(place.sourceId, place);
        }
      }
      return [...found.values()];
    }
  },
};
