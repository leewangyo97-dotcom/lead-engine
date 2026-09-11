import * as chromeLauncher from "chrome-launcher";
import { eq } from "drizzle-orm";
import { getDb } from "../lib/db";
import { prospects } from "../lib/db/schema";
import { loadLocalEnv } from "../lib/env";
import {
  describe as summarise,
  readLighthouse,
  type LighthouseSignals,
  type ReportLike,
} from "../lib/places/lighthouse-signals";

/**
 * One prospect's site, measured properly, on demand.
 *
 *   pnpm lh <prospectId>          measure and store
 *   pnpm lh <prospectId> --dry    measure and print, store nothing
 *
 * Deliberately not part of the nightly run. Measured against five real prospect
 * sites first: 12.6 seconds each on the mobile preset, 13.8 on desktop — the
 * cost is page load plus the audit suite, so the lighter preset buys nothing.
 * Two hundred sites would be 42 minutes against a 15-minute job budget that
 * enrichment already takes four of.
 *
 * Twelve seconds is nothing when it is one business you are about to write to,
 * which is the only place this belongs.
 *
 * Only the audits that said the same thing twice are kept — see
 * `lib/places/lighthouse-signals.ts` for what moved and by how much. The
 * performance score is not stored and is not printed, because a number that
 * swung fifteen points on one dentist's site between two sessions is not
 * something to put in front of its owner.
 */
const CATEGORIES = ["performance", "accessibility"];

function usage(): never {
  console.error("usage: pnpm lh <prospectId> [--dry]");
  process.exit(1);
}

async function main() {
  loadLocalEnv();

  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const id = args.find((a) => !a.startsWith("-"));
  if (!id) usage();

  const db = getDb();
  const [row] = await db
    .select({
      id: prospects.id,
      name: prospects.name,
      website: prospects.website,
      city: prospects.city,
      signals: prospects.siteSignals,
    })
    .from(prospects)
    .where(eq(prospects.id, id))
    .limit(1);

  if (!row) {
    console.error(`no prospect with id ${id}`);
    process.exit(1);
  }
  if (!row.website) {
    console.error(`${row.name} has no website on the record — nothing to measure`);
    process.exit(1);
  }

  console.log(`${row.name}${row.city ? ` · ${row.city}` : ""}`);
  console.log(`${row.website}\n`);

  const lighthouse = (await import("lighthouse")).default;
  const chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
  });

  const started = Date.now();
  let report: ReportLike;
  try {
    const result = await lighthouse(row.website, {
      logLevel: "silent",
      output: "json",
      onlyCategories: CATEGORIES,
      port: chrome.port,
    });
    if (!result) throw new Error("lighthouse returned nothing");
    report = result.lhr as unknown as ReportLike;
  } finally {
    // Chrome itself exits; on Windows the launcher then fails to delete its own
    // temp profile directory and throws EPERM out of kill(). Losing a measured
    // run to a cleanup error would be absurd, so the throw is swallowed and the
    // directory is left for the OS to reap.
    try {
      await chrome.kill();
    } catch {
      /* temp profile left behind; the browser is gone, which is what matters */
    }
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const read = readLighthouse(report);

  if (!read.ok) {
    console.error(`refused after ${seconds}s: ${read.reason}`);
    console.error("nothing written — a report about an error page is not a report about their site");
    process.exit(1);
  }

  console.log(summarise(read.signals).join("\n"));
  console.log(`\nmeasured in ${seconds}s`);

  if (dry) {
    console.log("--dry: nothing written");
    return;
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

  console.log(`stored on ${row.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
