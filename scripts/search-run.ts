import { eq } from "drizzle-orm";
import { getDb } from "../lib/db";
import { loadLocalEnv } from "../lib/env";
import { searches } from "../lib/db/schema";
import { runSearch } from "../lib/places/search-runner";
import { isPlaceCategory, PLACE_CATEGORIES, type PlaceCategory } from "../lib/places/osm-categories";

/**
 * The search worker. Creates a search and runs it, or drains whatever is queued.
 *
 *   pnpm search:run "Cebu City, Philippines" veterinary,clinics
 *   pnpm search:run --drain          # process everything queued by the API
 *
 * Discovery is Stage A only. Emails come from Stage B enrichment, which is the
 * next ticket — on this data most places have no website to enrich from, so the
 * counts below are the honest ceiling for email until that lands.
 */
async function main() {
  loadLocalEnv();
  const db = getDb();

  if (process.argv.includes("--drain")) {
    const queued = await db.select().from(searches).where(eq(searches.status, "queued"));
    if (!queued.length) {
      console.log("search-run: nothing queued");
      return;
    }
    for (const s of queued) {
      const r = await runSearch(s.id);
      console.log(`search-run: ${s.query} — found ${r.found}, new ${r.inserted}, dupes ${r.duplicates}`);
    }
    return;
  }

  const query = process.argv[2];
  const categories = (process.argv[3] ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(isPlaceCategory) as PlaceCategory[];

  if (!query || !categories.length) {
    console.error(
      'usage: pnpm search:run "<place>" <categories>   or   pnpm search:run --drain\n' +
        `categories: ${PLACE_CATEGORIES.join(", ")}`,
    );
    process.exit(1);
  }

  const [row] = await db
    .insert(searches)
    .values({ query, categories, radiusM: 15_000 })
    .returning({ id: searches.id });

  const r = await runSearch(row.id);
  console.log(
    `search-run: ${query} — found ${r.found}, new ${r.inserted}, dupes ${r.duplicates} (search ${row.id})`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
