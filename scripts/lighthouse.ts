import * as chromeLauncher from "chrome-launcher";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { getDb } from "../lib/db";
import { prospects } from "../lib/db/schema";
import { loadLocalEnv } from "../lib/env";
import {
  describe as summarise,
  needsMeasuring,
  readLighthouse,
  type LighthouseSignals,
  type ReportLike,
} from "../lib/places/lighthouse-signals";
import { getRobots, isAllowed } from "../lib/places/robots";

/**
 * Prospect websites, measured properly.
 *
 *   pnpm lh <prospectId>          one prospect
 *   pnpm lh --limit=25            the best unmeasured enriched rows
 *   pnpm lh <...> --dry           measure and print, store nothing
 *
 * Deliberately not part of the nightly run. Measured against five real prospect
 * sites first: 12.6 seconds each on the mobile preset, 13.8 on desktop — the
 * cost is page load plus the audit suite, so the lighter preset buys nothing.
 * Two hundred sites would be 42 minutes against a fifteen-minute job budget that
 * enrichment already takes four of.
 *
 * Only the audits that said the same thing twice are kept — see
 * `lib/places/lighthouse-signals.ts` for what moved and by how much. The
 * performance score is not stored and is not printed, because a number that
 * swung fifteen points on one dentist's site between two sessions is not
 * something to put in front of its owner.
 *
 * **Enriched rows only in batch mode.** 9,294 scored prospects with a website
 * have not been measured, and all but 126 of them are still in the enrichment
 * queue — their site has never been fetched at all. Enrichment is what
 * establishes that a URL is a real page rather than a parked domain, and what
 * reads robots.txt. Measuring ahead of it would be thirty-eight hours of
 * headless Chrome spent partly on domains that are for sale.
 *
 * If a desktop preset is ever added here, store the viewport with the reading:
 * every `contrast` fact says "at phone width" and would silently become false.
 */
const CATEGORIES = ["performance", "accessibility"];
const DEFAULT_LIMIT = 25;

/** How far back to look for a reading whose site has since moved. */
const STALE_SCAN = 500;

interface Row {
  id: string;
  name: string;
  website: string | null;
  city: string | null;
  score: number | null;
  signals: Record<string, unknown> | null;
}

const COLUMNS = {
  id: prospects.id,
  name: prospects.name,
  website: prospects.website,
  city: prospects.city,
  score: prospects.score,
  signals: prospects.siteSignals,
};

function usage(): never {
  console.error("usage: pnpm lh <prospectId> [--dry]");
  console.error("       pnpm lh --limit=25 [--dry]");
  process.exit(1);
}

/**
 * robots.txt, which the enricher respects and this has to as well.
 *
 * A site owner who wrote `Disallow: /` is a poor person to cold-email about
 * building them a website. Enrichment checks this before it fetches a page;
 * Lighthouse launches a browser and loads whatever it is given, so the check
 * belongs here rather than being inherited.
 */
async function allowedByRobots(website: string): Promise<boolean> {
  try {
    const url = new URL(website);
    const rules = await getRobots(url.origin);
    return isAllowed(rules, url.pathname);
  } catch {
    // An unparseable URL is not a refusal to answer; the measurement will fail
    // on its own and say so.
    return true;
  }
}

async function measure(
  lighthouse: typeof import("lighthouse").default,
  port: number,
  url: string,
): Promise<ReportLike> {
  const result = await lighthouse(url, {
    logLevel: "silent",
    output: "json",
    onlyCategories: CATEGORIES,
    port,
  });
  if (!result) throw new Error("lighthouse returned nothing");
  return result.lhr as unknown as ReportLike;
}

async function main() {
  loadLocalEnv();

  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const id = args.find((a) => !a.startsWith("-"));
  const limitFlag = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
  const parsedLimit = limitFlag === undefined ? undefined : Number(limitFlag);
  // A misspelt flag must not silently mean "no limit" — this one opens a browser
  // against somebody's website per row.
  const limit =
    parsedLimit !== undefined && Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.floor(parsedLimit)
      : DEFAULT_LIMIT;

  if (!id && limitFlag === undefined && !args.length) usage();

  const db = getDb();
  let queue: Row[];

  if (id) {
    const [row] = await db.select(COLUMNS).from(prospects).where(eq(prospects.id, id)).limit(1);
    if (!row) {
      console.error(`no prospect with id ${id}`);
      process.exit(1);
    }
    if (!row.website) {
      console.error(`${row.name} has no website on the record — nothing to measure`);
      process.exit(1);
    }
    queue = [row];
  } else {
    const eligible = and(
      isNotNull(prospects.website),
      isNotNull(prospects.score),
      eq(prospects.enrichmentStatus, "enriched"),
    );

    /*
     * "Not measured yet" is asked of the database, not of a prefetched window.
     *
     * The first version took `limit * 4` rows ordered by score and filtered them
     * in JS. It worked once and then quietly stopped: as the best rows get
     * measured they fill the window, so `--limit=3` returned two and a later
     * `--limit=25` would have returned none while a hundred rows waited. The
     * filter has to run over the table.
     */
    const unmeasured = await db
      .select(COLUMNS)
      .from(prospects)
      .where(and(eligible, sql`${prospects.siteSignals} -> 'lighthouse' is null`))
      // Best first, same as the enrichment queue: the budget is small and a
      // reachable high scorer should not wait behind an arbitrary row.
      .orderBy(desc(prospects.score), prospects.name)
      .limit(limit);

    /*
     * Readings taken on a site that has since moved, which are worse than
     * missing: the row looks measured and describes a server the business no
     * longer uses. Few of these exist, so they are fetched whole and go first.
     */
    const measuredRows = await db
      .select(COLUMNS)
      .from(prospects)
      .where(and(eligible, sql`${prospects.siteSignals} -> 'lighthouse' is not null`))
      .orderBy(desc(prospects.score), prospects.name)
      .limit(STALE_SCAN);

    const stale = measuredRows.filter((r) =>
      needsMeasuring({ website: r.website, siteSignals: r.signals }),
    );

    queue = [...stale, ...unmeasured].slice(0, limit);
    if (!queue.length) {
      console.log("lh: nothing enriched and scored is waiting to be measured");
      return;
    }
    const staleInQueue = queue.filter((r) => stale.includes(r)).length;
    console.log(
      `lh: ${queue.length} to measure${staleInQueue ? ` (${staleInQueue} re-measured, the site moved)` : ""}` +
        `${dry ? " — dry run" : ""}\n`,
    );
  }

  const lighthouse = (await import("lighthouse")).default;
  const chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
  });

  let measured = 0;
  let refused = 0;
  let blocked = 0;

  try {
    for (const row of queue) {
      const website = row.website!;
      const label = `${row.name}${row.city ? ` · ${row.city}` : ""}`;

      if (!(await allowedByRobots(website))) {
        blocked++;
        console.log(`${label}\n  robots.txt disallows it — skipped\n`);
        continue;
      }

      const started = Date.now();
      let report: ReportLike;
      try {
        report = await measure(lighthouse, chrome.port, website);
      } catch (err) {
        refused++;
        console.log(`${label}\n  ${website}\n  failed: ${(err as Error).message.slice(0, 100)}\n`);
        continue;
      }

      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      const read = readLighthouse(report);

      if (!read.ok) {
        refused++;
        // Nothing is written. A report about an error page is not a report about
        // their site, and storing one is how a false claim reaches a draft.
        console.log(`${label}\n  ${website}\n  refused after ${seconds}s: ${read.reason}\n`);
        continue;
      }

      measured++;
      console.log(`${label}\n  ${website}`);
      console.log(summarise(read.signals).map((l) => `  ${l}`).join("\n"));
      console.log(`  ${seconds}s`);

      if (dry) {
        console.log("  --dry: nothing written\n");
        continue;
      }

      // Merged, not replaced. `siteSignals` also holds what the HTML enricher
      // measured — noHttps, noViewport, hasBookingForm — and this knows nothing
      // about those.
      const existing = (row.signals ?? {}) as Record<string, unknown>;
      await db
        .update(prospects)
        .set({
          siteSignals: { ...existing, lighthouse: read.signals satisfies LighthouseSignals },
          updatedAt: new Date(),
        })
        .where(eq(prospects.id, row.id));
      console.log(`  stored\n`);
    }
  } finally {
    // Chrome itself exits; on Windows the launcher then fails to delete its own
    // temp profile directory and throws EPERM out of kill(). Losing a batch of
    // measured runs to a cleanup error would be absurd, so the throw is
    // swallowed and the directory is left for the OS to reap.
    try {
      await chrome.kill();
    } catch {
      /* temp profile left behind; the browser is gone, which is what matters */
    }
  }

  if (queue.length > 1) {
    console.log(
      `lh: ${measured} measured, ${refused} refused, ${blocked} disallowed by robots.txt`,
    );
  }
  if (!measured && queue.length === 1) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
