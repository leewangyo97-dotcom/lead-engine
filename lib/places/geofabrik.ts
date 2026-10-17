import { fetchJson } from "../sources/fetch-json";
import { OSM_USER_AGENT } from "./nominatim";

/**
 * Geofabrik's daily extracts of OpenStreetMap (download.geofabrik.de), for
 * whole-country searches: one download a country, filtered on the machine by
 * osmium (lib/places/osmium.ts), instead of a query per category that the free
 * Overpass server answers one at a time. Same data, same tags; the extract is
 * at most a day old.
 */
export const GEOFABRIK_INDEX = "https://download.geofabrik.de/index-v1.json";

export interface GeofabrikIndex {
  features: {
    properties: {
      id: string;
      name: string;
      "iso3166-1:alpha2"?: string[];
      urls?: { pbf?: string };
    };
  }[];
}

export interface CountryExtract {
  id: string;
  name: string;
  pbf: string;
}

/**
 * The smallest extract holding the whole country: its own where there is one
 * (canada), else the shared one it is in (malaysia-singapore-brunei). Regions
 * of a country carry ISO 3166-2 codes, not alpha-2, so they never match.
 */
export function countryExtract(index: GeofabrikIndex, countryCode: string): CountryExtract | null {
  const code = countryCode.toUpperCase();
  const [best] = index.features
    .map((f) => f.properties)
    .filter((p) => p.urls?.pbf && p["iso3166-1:alpha2"]?.includes(code))
    .sort((a, b) => a["iso3166-1:alpha2"]!.length - b["iso3166-1:alpha2"]!.length);
  return best ? { id: best.id, name: best.name, pbf: best.urls!.pbf! } : null;
}

export function fetchGeofabrikIndex(): Promise<GeofabrikIndex> {
  return fetchJson<GeofabrikIndex>(GEOFABRIK_INDEX, {
    headers: { "User-Agent": OSM_USER_AGENT },
    timeoutMs: 60_000,
  });
}
