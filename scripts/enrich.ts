import { loadLocalEnv } from "../lib/env";
import { runEnrichment } from "../lib/places/enrich";

/**
 * The Stage B worker.
 *
 *   pnpm enrich                    # up to 50 pending prospects with a website
 *   pnpm enrich <searchId> [limit] # just one search
 *
 * Runs serially with a one-second gap per host, so 50 prospects take a minute or
 * two. That is the point: this reads other people's servers.
 */
async function main() {
  loadLocalEnv();

  const args = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const searchId = args[0];
  const limit = args[1] ? Number(args[1]) : undefined;

  const started = Date.now();
  const progress = await runEnrichment({ searchId, limit });
  const seconds = Math.round((Date.now() - started) / 1000);

  if (progress.considered === 0) {
    console.log("enrich: nothing pending with a website");
    console.log("        Stage A stores a website only when OSM has the tag, which is rare.");
    return;
  }

  console.log(
    `enrich: ${progress.considered} considered, ${progress.enriched} enriched, ` +
      `${progress.noContact} no contact found, ${progress.blocked} robots-blocked, ` +
      `${progress.failed} failed — ${seconds}s`,
  );
}

main().catch((err) => {
  console.error("enrich:", err instanceof Error ? err.message : err);
  process.exit(1);
});
