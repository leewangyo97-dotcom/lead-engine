import { loadLocalEnv } from "../lib/env";
import { refreshProspects } from "../lib/places/refresh";
import { parseArgs } from "../lib/places/cli-args";

/**
 * Re-reads stored prospects from OpenStreetMap.
 *
 *   pnpm prospects:refresh [searchId] [--limit=200]
 *
 * Map data, not websites: one Overpass request covers the batch, while
 * re-reading every website belongs in `pnpm enrich` at a second per host.
 * Monthly is about right — businesses do not move often, and the free endpoint
 * is shared.
 */
async function main() {
  loadLocalEnv();

  const { searchId, limit } = parseArgs(process.argv.slice(2), 200);

  const progress = await refreshProspects({ searchId, limit, enrich: false });

  if (progress.considered === 0) {
    console.log("prospects:refresh: nothing stored yet");
    return;
  }

  console.log(
    `prospects:refresh: ${progress.considered} checked — ${progress.updated} updated, ` +
      `${progress.unchanged} unchanged, ${progress.missing} no longer on the map`,
  );
}

main().catch((err) => {
  console.error("prospects:refresh:", err instanceof Error ? err.message : err);
  process.exit(1);
});
