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
  autoRepair: [
    ["shop", "car_repair"],
    ["shop", "car"],
    ["shop", "tyres"],
  ],

  /*
   * Categories added after the first real searches. The ones above were chosen
   * from the Philippine market, where almost nothing has a website. These are
   * trades and practices that sell to a wider area, where a website earns its
   * keep and is more often missing than you would expect.
   */
  contractors: [
    ["craft", "builder"],
    ["craft", "carpenter"],
    ["craft", "electrician"],
    ["craft", "plumber"],
    ["craft", "hvac"],
    ["shop", "doityourself"],
  ],
  veterinaryHospitals: [
    ["amenity", "animal_boarding"],
    ["amenity", "animal_shelter"],
    ["shop", "pet"],
    ["shop", "pet_grooming"],
  ],
  eventServices: [
    ["shop", "photo"],
    ["craft", "photographer"],
    ["shop", "florist"],
    ["shop", "wedding"],
    ["amenity", "events_venue"],
  ],
  trades: [
    ["craft", "painter"],
    ["craft", "roofer"],
    ["craft", "gardener"],
    ["craft", "locksmith"],
    ["craft", "shoemaker"],
    ["craft", "tailor"],
  ],
  professionalServices: [
    ["office", "insurance"],
    ["office", "financial"],
    ["office", "tax_advisor"],
    ["office", "consulting"],
    ["office", "architect"],
    ["office", "surveyor"],
  ],
  childcare: [
    ["amenity", "childcare"],
    ["leisure", "dance"],
    ["leisure", "sports_centre"],
  ],
  medicalSpecialists: [
    ["healthcare", "physiotherapist"],
    ["healthcare", "psychotherapist"],
    ["healthcare", "optometrist"],
    ["shop", "optician"],
    ["healthcare", "podiatrist"],
    ["healthcare", "midwife"],
  ],
  foodProducers: [
    ["shop", "bakery"],
    ["shop", "butcher"],
    ["shop", "greengrocer"],
    ["shop", "deli"],
    ["craft", "brewery"],
  ],
} as const satisfies Record<string, readonly (readonly [string, string])[]>;

export type PlaceCategory = keyof typeof OSM_CATEGORIES;

export const PLACE_CATEGORIES = Object.keys(OSM_CATEGORIES) as PlaceCategory[];

export function isPlaceCategory(value: string): value is PlaceCategory {
  return value in OSM_CATEGORIES;
}
