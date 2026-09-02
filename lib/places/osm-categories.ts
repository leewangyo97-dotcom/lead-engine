/**
 * Category to OpenStreetMap tag mapping.
 *
 * Kept in its own file because it is edited often: OSM tagging varies by region,
 * and the right set for the Philippines is not the right set for the US.
 */
export const OSM_CATEGORIES = {
  schools: [
    ["amenity", "school"],
    ["amenity", "college"],
    ["amenity", "university"],
    ["amenity", "kindergarten"],
    ["amenity", "language_school"],
    ["amenity", "driving_school"],
  ],
  clinics: [
    ["amenity", "clinic"],
    ["amenity", "doctors"],
    ["healthcare", "clinic"],
  ],
  veterinary: [["amenity", "veterinary"]],
  dentists: [["amenity", "dentist"]],
  pharmacies: [["amenity", "pharmacy"]],
  restaurants: [
    ["amenity", "restaurant"],
    ["amenity", "cafe"],
    ["amenity", "fast_food"],
  ],
  gyms: [["leisure", "fitness_centre"]],
  salons: [
    ["shop", "hairdresser"],
    ["shop", "beauty"],
    ["leisure", "spa"],
  ],
  lawFirms: [["office", "lawyer"]],
  accountants: [["office", "accountant"]],
  realEstate: [["office", "estate_agent"]],
  hotels: [
    ["tourism", "hotel"],
    ["tourism", "guest_house"],
  ],
  autoRepair: [["shop", "car_repair"]],
} as const satisfies Record<string, readonly (readonly [string, string])[]>;

export type PlaceCategory = keyof typeof OSM_CATEGORIES;

export const PLACE_CATEGORIES = Object.keys(OSM_CATEGORIES) as PlaceCategory[];

export function isPlaceCategory(value: string): value is PlaceCategory {
  return value in OSM_CATEGORIES;
}
