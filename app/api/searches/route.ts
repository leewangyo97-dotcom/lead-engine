import { getDb } from "@/lib/db";
import { searches } from "@/lib/db/schema";
import { geocode } from "@/lib/places/nominatim";
import { runSearch } from "@/lib/places/search-runner";
import { isPlaceCategory, type PlaceCategory } from "@/lib/places/osm-categories";

export const dynamic = "force-dynamic";
// A city search finishes in a few seconds; anything longer is queued below.
export const maxDuration = 60;

/**
 * Creates a search, and runs it here when that is honest.
 *
 * A radius search over a city takes two or three seconds — queueing it would
 * mean the user watches a spinner for a job that could already have finished.
 * An area search over a whole country takes minutes, which no request should
 * hold open, so that one is queued for `pnpm search:run --drain`.
 *
 * Geocoding first is what tells the two apart, and it costs one second.
 */
export async function POST(request: Request) {
  let payload: { query?: string; categories?: string[]; radiusM?: number };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }

  const query = payload.query?.trim();
  const categories = (payload.categories ?? []).filter(isPlaceCategory) as PlaceCategory[];

  if (!query) return Response.json({ error: "a location is required" }, { status: 400 });
  if (!categories.length) {
    return Response.json({ error: "pick at least one category" }, { status: 400 });
  }

  const db = getDb();

  let place;
  try {
    place = await geocode(query);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "geocoding failed" },
      { status: 502 },
    );
  }

  if (!place) {
    return Response.json({ error: `could not find "${query}"` }, { status: 404 });
  }

  const [row] = await db
    .insert(searches)
    .values({
      query,
      categories,
      radiusM: place.isArea ? null : (payload.radiusM ?? 15_000),
      resolvedName: place.displayName,
      lat: place.lat,
      lon: place.lon,
      countryCode: place.countryCode,
      osmId: place.osmId,
      isArea: place.isArea,
    })
    .returning({ id: searches.id });

  if (place.isArea) {
    return Response.json({
      searchId: row.id,
      resolvedName: place.displayName,
      queued: true,
      note: "Whole-country searches run in the background. Run `pnpm search:run --drain`.",
    });
  }

  try {
    const progress = await runSearch(row.id);
    return Response.json({ searchId: row.id, resolvedName: place.displayName, ...progress });
  } catch (err) {
    // runSearch has already marked the row failed with the reason; the client
    // needs the message, not a 500 with nothing in it.
    return Response.json(
      { searchId: row.id, error: err instanceof Error ? err.message : "search failed" },
      { status: 502 },
    );
  }
}
