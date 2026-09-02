import { geocode } from "../lib/places/nominatim";
import { overpassProvider } from "../lib/places/overpass";
import { isPlaceCategory, PLACE_CATEGORIES, type PlaceCategory } from "../lib/places/osm-categories";

/**
 * Proves discovery works before any UI exists, which is step 1 of the build
 * order for a reason: a results table over a pipeline that returns nothing is a
 * day spent on the wrong problem.
 *
 *   pnpm places:probe "Cebu City, Philippines" veterinary,clinics
 *   pnpm places:probe "Philippines" veterinary          # area search
 *
 * It also answers the question the spec cares most about — how many of these
 * places have a website at all, since that is the only path to an email.
 */
async function main() {
  const query = process.argv[2] ?? "Cebu City, Philippines";
  const requested = (process.argv[3] ?? "veterinary")
    .split(",")
    .map((c) => c.trim())
    .filter(isPlaceCategory) as PlaceCategory[];

  if (!requested.length) {
    console.error(`no valid categories. known: ${PLACE_CATEGORIES.join(", ")}`);
    process.exit(1);
  }

  const started = Date.now();
  const place = await geocode(query);
  if (!place) {
    console.error(`could not geocode "${query}"`);
    process.exit(1);
  }

  console.log(`resolved: ${place.displayName}`);
  console.log(
    `          ${place.lat.toFixed(4)}, ${place.lon.toFixed(4)} · ${place.osmType}/${place.osmId}` +
      ` · ${place.countryCode ?? "??"} · ${place.isArea ? "area search" : "radius search"}`,
  );

  const places = place.isArea
    ? await overpassProvider.searchArea!({ osmId: place.osmId, categories: requested })
    : await overpassProvider.search({
        lat: place.lat,
        lon: place.lon,
        radiusM: 15_000,
        categories: requested,
      });

  const withSite = places.filter((p) => p.website).length;
  const withPhone = places.filter((p) => p.phone).length;
  const withEmail = places.filter((p) => p.email).length;

  console.log(`\nfound ${places.length} place(s) in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(
    `  website ${withSite} · phone ${withPhone} · email ${withEmail}` +
      `  (email is Stage B's job — OSM rarely has one)`,
  );

  for (const p of places.slice(0, 8)) {
    console.log(
      `  ${p.name.slice(0, 34).padEnd(36)} ${(p.city ?? "").slice(0, 14).padEnd(15)} ` +
        `${p.website ? "site" : "  - "} ${p.phone ? "tel" : "  - "}`,
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
