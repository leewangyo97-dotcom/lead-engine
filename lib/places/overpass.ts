import { fetchJson } from "../sources/fetch-json";
import { OSM_CATEGORIES, type PlaceCategory } from "./osm-categories";
import { OSM_USER_AGENT } from "./nominatim";
import type { PlaceProvider, PlaceSearchInput, RawPlace } from "./types";

const OVERPASS = "https://overpass-api.de/api/interpreter";

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
    `area(${AREA_ID_OFFSET + osmId})->.searchArea;\n(\n${clauses}\n);\nout center tags;`
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
    city: tags["addr:city"],
    postcode: tags["addr:postcode"],
    openingHours: tags.opening_hours,
  };
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

async function run(query: string, timeoutMs: number, requested: PlaceCategory[]) {
  try {
    const data = await fetchJson<{ elements: OverpassElement[] }>(OVERPASS, {
      method: "POST",
      body: new URLSearchParams({ data: query }).toString(),
      headers: {
        "User-Agent": OSM_USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      timeoutMs,
    });

    return data.elements
      .map((el) => toRawPlace(el, requested))
      .filter((p): p is RawPlace => p !== null);
  } catch (err) {
    throw new Error(friendlyOverpassError(err instanceof Error ? err.message : String(err)));
  }
}

export const overpassProvider: PlaceProvider = {
  name: "overpass",

  async search(input: PlaceSearchInput): Promise<RawPlace[]> {
    return run(buildRadiusQuery(input), 100_000, input.categories);
  },

  async searchArea({ osmId, categories }): Promise<RawPlace[]> {
    // A country-wide query genuinely takes minutes; the client timeout has to
    // exceed the [timeout:180] in the query or we abort work Overpass is doing.
    return run(buildAreaQuery(osmId, categories), 200_000, categories);
  },
};
