import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { getDb } from "../lib/db";
import { prospects } from "../lib/db/schema";
import { loadLocalEnv } from "../lib/env";
import { runEnrichment } from "../lib/places/enrich";
import { parseArgs } from "../lib/places/cli-args";

/**
 * The Stage B worker.
 *
 *   pnpm enrich                    # up to 50 pending prospects with a website
 *   pnpm enrich <searchId> [limit] # just one search
 *   pnpm enrich --limit=200        # bounded, for the nightly job
 *   pnpm enrich --again [--limit=N] # re-read sites read before that gave no email
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

/**
 * Sites already read that gave no email, read again: for when the reading
 * improves. Hidden addresses (Cloudflare's "email protection", "info [at]
 * site [dot] com") were missed until 17 Oct; on a sample of 40 such sites,
 * 5 had one. Only prospects still New, in batches, at the same pace.
 */
async function again(limit: number) {
  const db = getDb();
  const rows = await db
    .select({ id: prospects.id })
    .from(prospects)
    .where(
      and(
        isNotNull(prospects.website),
        isNull(prospects.email),
        inArray(prospects.enrichmentStatus, ["enriched", "no_contact_found"]),
        eq(prospects.status, "new"),
      ),
    )
    .limit(limit);
  let gained = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const ids = rows.slice(i, i + 100).map((r) => r.id);
    await db.update(prospects).set({ enrichmentStatus: "pending" }).where(inArray(prospects.id, ids));
    await runEnrichment({ ids, limit: ids.length });
    const found = await db
      .select({ id: prospects.id })
      .from(prospects)
      .where(and(inArray(prospects.id, ids), isNotNull(prospects.email)));
    gained += found.length;
    console.log(`enrich --again: ${Math.min(i + 100, rows.length)} of ${rows.length} re-read, ${gained} now with an email`);
  }
}

async function main() {
  loadLocalEnv();

  const { searchId, limit } = parseArgs(process.argv.slice(2), 50);
  if (process.argv.includes("--again")) {
    await again(process.argv.some((a) => a.startsWith("--limit=")) ? (limit ?? 5000) : 5000);
    return;
  }

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
