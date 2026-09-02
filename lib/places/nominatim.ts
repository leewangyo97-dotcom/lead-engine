import { fetchJson } from "../sources/fetch-json";
import { nominatimLimiter } from "./rate-limit";
import type { GeocodedPlace } from "./types";

/**
 * Geocoding via Nominatim.
 *
 * Both Nominatim and Overpass require a User-Agent identifying the application
 * with a way to contact its operator; a default library UA is blocked outright.
 * Every call goes through a shared serial limiter because the published limit is
 * one request per second and breaching it gets the IP banned, not throttled.
 */
export const OSM_USER_AGENT =
  "lead-engine/0.1 (personal lead-generation tool; joshuasenining.dev)";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

/** Place types where a radius is meaningless and an admin area should be used. */
const AREA_TYPES = new Set([
  "country",
  "state",
  "region",
  "province",
  "county",
  "administrative",
]);

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  osm_type: string;
  osm_id: number;
  type?: string;
  addresstype?: string;
  boundingbox?: [string, string, string, string];
  address?: { country_code?: string };
}

export function toGeocodedPlace(r: NominatimResult): GeocodedPlace {
  const osmType = (r.osm_type === "relation" ? "relation" : r.osm_type === "way" ? "way" : "node") as
    | "node"
    | "way"
    | "relation";

  return {
    displayName: r.display_name,
    lat: Number(r.lat),
    lon: Number(r.lon),
    osmType,
    osmId: r.osm_id,
    countryCode: r.address?.country_code?.toUpperCase(),
    boundingBox: r.boundingbox?.map(Number) as [number, number, number, number] | undefined,
    // A country or region must be searched as an area: a 15km circle around the
    // centroid of the Philippines returns the sea.
    isArea: osmType === "relation" && AREA_TYPES.has(r.addresstype ?? r.type ?? ""),
  };
}

export async function geocode(query: string): Promise<GeocodedPlace | null> {
  const url =
    `${NOMINATIM}?q=${encodeURIComponent(query)}` +
    "&format=jsonv2&limit=1&addressdetails=1";

  const results = await nominatimLimiter.run(() =>
    fetchJson<NominatimResult[]>(url, {
      headers: { "User-Agent": OSM_USER_AGENT, Accept: "application/json" },
      timeoutMs: 20_000,
    }),
  );

  if (!results.length) return null;
  return toGeocodedPlace(results[0]);
}
