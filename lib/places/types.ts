import type { PlaceCategory } from "./osm-categories";

/**
 * What a discovery provider returns, before enrichment.
 *
 * Deliberately the raw facts a map database holds and nothing more. Email is
 * absent because OpenStreetMap almost never has one — that is Stage B's job, and
 * pretending otherwise here would hide where the real work is.
 */
export interface RawPlace {
  /** Stable id for dedupe, e.g. "osm:node/123456". */
  sourceId: string;
  sourceProvider: string;
  name: string;
  category: PlaceCategory;
  lat: number;
  lon: number;
  website?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  facebook?: string;
  addressLine?: string;
  city?: string;
  postcode?: string;
  openingHours?: string;
}

export interface PlaceSearchInput {
  lat: number;
  lon: number;
  radiusM: number;
  categories: PlaceCategory[];
}

/**
 * Discovery behind one interface so the provider can change with an env var.
 * OverpassProvider is free and unkeyed; Geoapify is the same OSM data behind a
 * managed API, and is a later ticket.
 */
export interface PlaceProvider {
  readonly name: string;
  search(input: PlaceSearchInput): Promise<RawPlace[]>;
  /** Whole-country and region searches resolve an admin area instead of a radius. */
  searchArea?(input: { osmId: number; categories: PlaceCategory[] }): Promise<RawPlace[]>;
}

export interface GeocodedPlace {
  displayName: string;
  lat: number;
  lon: number;
  osmType: "node" | "way" | "relation";
  osmId: number;
  countryCode?: string;
  boundingBox?: [number, number, number, number];
  /** True when the match is a country/region, where a radius makes no sense. */
  isArea: boolean;
}
