import { loadLocalEnv } from "../lib/env";
import { geocode } from "../lib/places/nominatim";
import { isPlaceCategory, PLACE_CATEGORIES, type PlaceCategory } from "../lib/places/osm-categories";
import { countryPlaces, osmiumAvailable } from "../lib/places/osmium";
import { overpassProvider } from "../lib/places/overpass";
import type { RawPlace } from "../lib/places/types";

/**
 * Runs one whole-country search both ways, Overpass and Geofabrik + osmium,
 * and compares what each found, place by place. Nothing is written.
 *
 *   pnpm places:compare "Luxembourg" [dentists,pharmacies,…]
 *
 * The two should agree but for the gap between the extract (up to a day old)
 * and the live map, so a difference worth worrying about is one the edit
 * history does not explain. Prints counts, and up to five ids each way.
 */
async function main() {
  loadLocalEnv();
  const query = process.argv[2];
  const categories = (process.argv[3]?.split(",").filter(isPlaceCategory) as PlaceCategory[] | undefined) ?? [
    ...PLACE_CATEGORIES,
  ];
  if (!query) throw new Error('usage: pnpm places:compare "<country>" [categories]');
  if (!osmiumAvailable()) throw new Error("osmium is not available: install osmium-tool, or set OSMIUM_DOCKER=1 with Docker running");

  const place = await geocode(query);
  if (!place?.isCountry || !place.countryCode) throw new Error(`"${query}" is not a country to Nominatim`);
  console.log(`places:compare: ${place.displayName} (relation ${place.osmId}), ${categories.length} categories`);

  let t = Date.now();
  const fromOverpass: RawPlace[] = [];
  for (const category of categories) {
    fromOverpass.push(
      ...(await overpassProvider.searchArea!({ osmId: place.osmId, categories: [category], countryCode: place.countryCode })),
    );
  }
  const overpassSeconds = Math.round((Date.now() - t) / 1000);

  t = Date.now();
  const fromOsmium = await countryPlaces({
    countryCode: place.countryCode,
    osmId: place.osmId,
    categories,
    log: (line) => console.log(`places:compare: ${line}`),
  });
  const osmiumSeconds = Math.round((Date.now() - t) / 1000);

  const a = new Map(fromOverpass.map((p) => [p.sourceId, p]));
  const b = new Map(fromOsmium.map((p) => [p.sourceId, p]));
  const both = [...a.keys()].filter((id) => b.has(id));
  const onlyOverpass = [...a.keys()].filter((id) => !b.has(id));
  const onlyOsmium = [...b.keys()].filter((id) => !a.has(id));
  const sameCategory = both.filter((id) => a.get(id)!.category === b.get(id)!.category).length;
  const sameName = both.filter((id) => a.get(id)!.name === b.get(id)!.name).length;
  // Within ~11 m: a way's centre computed the same way on both sides.
  const samePlace = both.filter(
    (id) => Math.abs(a.get(id)!.lat - b.get(id)!.lat) < 1e-4 && Math.abs(a.get(id)!.lon - b.get(id)!.lon) < 1e-4,
  ).length;

  console.log(
    [
      `Overpass: ${a.size} places in ${overpassSeconds}s · osmium: ${b.size} places in ${osmiumSeconds}s`,
      `in both: ${both.length} (${((100 * both.length) / Math.max(a.size, 1)).toFixed(1)}% of Overpass)`,
      `  same category ${sameCategory}, same name ${sameName}, same position ${samePlace}`,
      `only Overpass: ${onlyOverpass.length} ${onlyOverpass.slice(0, 5).join(" ")}`,
      `only osmium: ${onlyOsmium.length} ${onlyOsmium.slice(0, 5).join(" ")}`,
    ]
      .map((l) => `places:compare: ${l}`)
      .join("\n"),
  );
}

main().catch((err) => {
  console.error("places:compare:", err instanceof Error ? err.message : err);
  process.exit(1);
});
