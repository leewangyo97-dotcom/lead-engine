import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { prospects } from "../db/schema";
import { OSM_USER_AGENT } from "./nominatim";
import { getRobots, isAllowed } from "./robots";
import {
  extractEmails,
  extractPhones,
  extractSiteSignals,
  extractSocials,
  extractWhatsApp,
  type SiteSignals,
} from "./extract";

/**
 * Stage B: visit the business's own website and read the contact details off it.
 *
 * Stage A (Overpass) gives a name, a location and often a phone. It rarely gives
 * an email — measured on Cebu clinics, 2 of 82 had a website at all. So this
 * stage is worth little in that market and a lot in others, and it is written to
 * fail quietly per prospect rather than to assume it will find anything.
 */

/** Pages are capped: a homepage that streams 40 MB is a bug, not a lead. */
const MAX_BYTES = 1_500_000;
const PAGE_TIMEOUT_MS = 12_000;
/** One page per second per host, unless robots.txt asks for longer. */
const DEFAULT_HOST_DELAY_MS = 1000;
/** Homepage plus at most this many contact-ish pages. */
const MAX_EXTRA_PAGES = 2;

const CONTACT_HINT = /(contact|kontakt|about|reach)/i;

export interface EnrichDeps {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
}

export type EnrichStatus =
  | "enriched"
  | "no_website"
  | "fetch_failed"
  | "robots_blocked"
  | "no_contact_found";

export interface EnrichedFields {
  status: EnrichStatus;
  email?: string;
  emailConfidence?: "mailto" | "text";
  phoneE164?: string;
  whatsappE164?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  linkedinUrl?: string;
  signals?: SiteSignals;
}

interface Page {
  url: string;
  html: string;
}

async function fetchPage(url: string, fetchImpl: typeof fetch): Promise<Page | null> {
  const res = await fetchImpl(url, {
    headers: { "User-Agent": OSM_USER_AGENT, Accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
    signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
  });
  if (!res.ok) return null;

  // A PDF or an image cannot contain a mailto: href worth parsing, and reading
  // one spends the whole byte budget to learn nothing.
  const type = res.headers.get("content-type") ?? "";
  if (type && !type.includes("html")) return null;

  const body = await res.text();
  return { url: res.url || url, html: body.slice(0, MAX_BYTES) };
}

/** Contact-page candidates linked from the homepage. */
export function contactLinks(html: string, base: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    const href = m[1];
    if (!CONTACT_HINT.test(href)) continue;
    try {
      const url = new URL(href, base);
      // Staying on the same host: an "About us" link pointing at a franchise HQ
      // is a different business, and its address is the wrong one to write to.
      if (url.host !== new URL(base).host) continue;
      url.hash = "";
      out.add(url.toString());
    } catch {
      // A malformed href is the site's problem, not a reason to stop reading it.
    }
  }
  return [...out].slice(0, MAX_EXTRA_PAGES);
}

/**
 * Reads one website and returns what it found.
 *
 * Takes a URL rather than a row, and returns fields rather than writing them, so
 * that every decision about what to keep lives in `runEnrichment` where the
 * existing values are also in scope.
 */
export async function enrichSite(
  website: string | null,
  countryCode: string | null,
  deps: EnrichDeps = {},
): Promise<EnrichedFields> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  if (!website) return { status: "no_website" };

  let start: URL;
  try {
    start = new URL(website);
  } catch {
    return { status: "no_website" };
  }
  if (start.protocol !== "http:" && start.protocol !== "https:") {
    return { status: "no_website" };
  }

  const robots = await getRobots(start.origin, fetchImpl);
  if (!isAllowed(robots, start.pathname)) return { status: "robots_blocked" };
  const hostDelay = robots.crawlDelayMs ?? DEFAULT_HOST_DELAY_MS;

  let home: Page | null;
  try {
    home = await fetchPage(start.toString(), fetchImpl);
  } catch {
    return { status: "fetch_failed" };
  }
  if (!home) return { status: "fetch_failed" };

  const pages: Page[] = [home];

  // A homepage often carries a phone but keeps the email on /contact. That one
  // extra request is usually worth it; a third page rarely is.
  if (extractEmails(home.html).length === 0) {
    for (const link of contactLinks(home.html, home.url)) {
      if (!isAllowed(robots, new URL(link).pathname)) continue;
      await sleep(hostDelay);
      try {
        const page = await fetchPage(link, fetchImpl);
        if (page) pages.push(page);
      } catch {
        // One bad contact page does not invalidate the homepage's findings.
      }
    }
  }

  const combined = pages.map((p) => p.html).join("\n");

  // A mailto: is the business publishing its own address; a match in body text
  // is a guess. Sorting by that means the better source wins when both exist.
  const emails = extractEmails(combined).sort(
    (a, b) => Number(b.confidence === "mailto") - Number(a.confidence === "mailto"),
  );

  const whatsapp = extractWhatsApp(combined, countryCode);
  const phones = extractPhones(combined, countryCode);
  const socials = extractSocials(combined);
  const signals = extractSiteSignals(home.html, home.url);

  const reachable = emails[0] || whatsapp || phones[0] || socials.facebook;

  return {
    status: reachable ? "enriched" : "no_contact_found",
    email: emails[0]?.email,
    emailConfidence: emails[0]?.confidence,
    phoneE164: phones[0],
    whatsappE164: whatsapp ?? undefined,
    facebookUrl: socials.facebook,
    instagramUrl: socials.instagram,
    linkedinUrl: socials.linkedin,
    signals,
  };
}

export interface EnrichProgress {
  considered: number;
  enriched: number;
  noContact: number;
  blocked: number;
  failed: number;
}

/**
 * Enriches pending prospects that have a website.
 *
 * Serial by design. The queue is tens of rows, each host already waits a second
 * between pages, and a concurrency pool would buy a handful of seconds while
 * adding the one failure mode this feature cannot afford — hammering a small
 * business's shared host from a tool whose pitch is that it respects them.
 */
export async function runEnrichment(
  options: { searchId?: string; limit?: number } & EnrichDeps = {},
): Promise<EnrichProgress> {
  const db = getDb();
  const limit = options.limit ?? 50;
  const now = options.now ?? (() => new Date());

  // Rows with nothing to visit would otherwise sit at "pending" forever, which
  // reads as "not done yet" when the truth is "there is nothing to do". Saying
  // so makes the pending count mean what the UI implies it means.
  const noSite = and(eq(prospects.enrichmentStatus, "pending"), isNull(prospects.website));
  await db
    .update(prospects)
    .set({ enrichmentStatus: "no_website", updatedAt: now() })
    .where(options.searchId ? and(noSite, eq(prospects.searchId, options.searchId)) : noSite);

  const pending = and(eq(prospects.enrichmentStatus, "pending"), isNotNull(prospects.website));

  const queue = await db
    .select({
      id: prospects.id,
      website: prospects.website,
      countryCode: prospects.countryCode,
      email: prospects.email,
      emailConfidence: prospects.emailConfidence,
      phoneE164: prospects.phoneE164,
      whatsappE164: prospects.whatsappE164,
      facebookUrl: prospects.facebookUrl,
      instagramUrl: prospects.instagramUrl,
      linkedinUrl: prospects.linkedinUrl,
    })
    .from(prospects)
    .where(options.searchId ? and(pending, eq(prospects.searchId, options.searchId)) : pending)
    .limit(limit);

  const progress: EnrichProgress = {
    considered: queue.length,
    enriched: 0,
    noContact: 0,
    blocked: 0,
    failed: 0,
  };

  for (const row of queue) {
    let result: EnrichedFields;
    try {
      result = await enrichSite(row.website, row.countryCode, options);
    } catch {
      result = { status: "fetch_failed" };
    }

    if (result.status === "enriched") progress.enriched++;
    else if (result.status === "no_contact_found") progress.noContact++;
    else if (result.status === "robots_blocked") progress.blocked++;
    else progress.failed++;

    // Scraped values fill gaps and never overwrite what OSM already held. An
    // OSM tag was written by someone who knows the business; a number in a
    // footer may belong to the agency that built the site. Merging in JS rather
    // than with a COALESCE in SQL keeps this rule legible and testable — and
    // avoids interpolating column identifiers into an UPDATE, which Drizzle
    // re-aliases.
    await db
      .update(prospects)
      .set({
        enrichmentStatus: result.status,
        lastEnrichedAt: now(),
        updatedAt: now(),
        email: row.email ?? result.email ?? null,
        emailConfidence: row.email ? row.emailConfidence : (result.emailConfidence ?? null),
        phoneE164: row.phoneE164 ?? result.phoneE164 ?? null,
        whatsappE164: row.whatsappE164 ?? result.whatsappE164 ?? null,
        // Kept so scoring can read measured facts later without fetching again.
      siteSignals: result.signals ? { ...result.signals } : null,
      facebookUrl: row.facebookUrl ?? result.facebookUrl ?? null,
        instagramUrl: row.instagramUrl ?? result.instagramUrl ?? null,
        linkedinUrl: row.linkedinUrl ?? result.linkedinUrl ?? null,
      })
      .where(eq(prospects.id, row.id));
  }

  return progress;
}
