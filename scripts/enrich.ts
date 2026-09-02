import { loadLocalEnv } from "../lib/env";
import { runEnrichment } from "../lib/places/enrich";
import { parseArgs } from "../lib/places/cli-args";

/**
 * The Stage B worker.
 *
 *   pnpm enrich                    # up to 50 pending prospects with a website
 *   pnpm enrich <searchId> [limit] # just one search
 *   pnpm enrich --limit=25         # bounded, for the nightly job
 *
 * Runs serially with a one-second gap per host, so 50 prospects take a minute or
 * two. That is the point: this reads other people's servers.
 */
/**
 * One malformed HTTP response killed a whole run.
 *
 * Node's HTTP parser raises an assertion from a socket event, outside any
 * try/catch around the fetch, so the process died mid-batch and the remaining
 * prospects went unvisited. A worker that reads other people's servers has to
 * survive a server that answers badly. Only that assertion is swallowed —
 * anything else still crashes, because a worker that hides its own bugs is
 * worse than one that stops.
 */
process.on("uncaughtException", (err: NodeJS.ErrnoException) => {
  if (err?.code === "ERR_ASSERTION" && /undici/.test(err.stack ?? "")) {
    console.error("enrich: ignored a malformed HTTP response from a server");
    return;
  }
  throw err;
});

async function main() {
  loadLocalEnv();

  const { searchId, limit } = parseArgs(process.argv.slice(2), 50);

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
      `${progress.noContact} no contact found, ${progress.blocked} refused, ` +
      `${progress.noWebsite} site gone, ${progress.failed} failed — ${seconds}s`,
  );
}

main().catch((err) => {
  console.error("enrich:", err instanceof Error ? err.message : err);
  process.exit(1);
});
