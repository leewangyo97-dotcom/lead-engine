/**
 * Reading a Lighthouse report down to the part that is safe to repeat.
 *
 * Lighthouse was measured against five real prospect sites before any of this
 * was written, and the headline number did not survive the measurement. The
 * same site, three consecutive runs, one browser:
 *
 *   The Roofing Guy        perf 55, 58, 58   LCP 6.0s, 5.8s, 5.7s
 *   Lynnette Chu, D.M.D.   perf 48, 56, 52   LCP 5.0s, 8.2s, 8.3s
 *
 * Eight points and 3.3 seconds of LCP on one site without touching it, and
 * fifteen points for that dentist across two sessions an hour apart. A message
 * saying "your site scores 61" would be a number invented by the weather on the
 * machine that ran it. Two drafts have already gone out with false claims about
 * a prospect's website — `scripts/verify-drafts.ts` exists because of them — and
 * this would be the same failure wearing a Google logo.
 *
 * Diffing every audit across two runs of the same site sorted them cleanly:
 *
 *   moved     first-contentful-paint, largest-contentful-paint, speed-index,
 *             total-blocking-time, interactive, unused-css-rules,
 *             image-delivery-insight
 *   identical total-byte-weight (10,475 KiB both runs, byte for byte),
 *             unsized-images, color-contrast, link-name, unminified-css,
 *             unused-javascript
 *
 * Audits that describe the page hold. Audits that describe the clock do not. So
 * only the first kind is read here, by an allow-list rather than a deny-list: a
 * new Lighthouse version adding another timing audit must be opted in, not
 * noticed later.
 *
 * The report is described structurally rather than imported from the lighthouse
 * package, so every rule here is testable against a fixture without launching a
 * browser — and so the app never pulls a headless-Chrome dependency into a build.
 */
import { hostOf } from "./host-groups";

/** The shape this reads out of a Lighthouse result. Everything else is ignored. */
export interface AuditLike {
  score: number | null;
  numericValue?: number;
  /**
   * What `numericValue` counts.
   *
   * Read rather than assumed, because assuming it cost a correctness bug here
   * first time round. The byte-efficiency audits carry `numericUnit:
   * "millisecond"` — `unused-javascript` reported `numericValue: 150` on a page
   * whose display value said "Est savings of 24 KiB". Storing that as a byte
   * count would have written a modelled *timing* estimate into a field promising
   * to hold only what survives two runs. The bytes are in `details`.
   */
  numericUnit?: string;
  displayValue?: string;
  details?: { items?: unknown[]; overallSavingsBytes?: number };
}

export interface ReportLike {
  requestedUrl?: string;
  finalDisplayedUrl?: string;
  runtimeError?: { code: string; message: string };
  audits: Record<string, AuditLike | undefined>;
}

/**
 * The audits proven identical across two runs of the same site.
 *
 * Named as a constant so the test can assert the volatile ones are absent — the
 * list is the guarantee, and a guarantee nothing checks is a comment.
 */
export const STABLE_AUDITS = [
  "total-byte-weight",
  "unsized-images",
  "color-contrast",
  "link-name",
  "unminified-css",
  "unused-javascript",
] as const;

/** Audits measured to move between runs. Never read; listed so the test can say so. */
export const VOLATILE_AUDITS = [
  "first-contentful-paint",
  "largest-contentful-paint",
  "speed-index",
  "total-blocking-time",
  "interactive",
  "unused-css-rules",
  "image-delivery-insight",
] as const;

export interface LighthouseSignals {
  /**
   * The page this was measured on.
   *
   * Kept because the reading outlives the run. `pnpm enrich` rewrites
   * `siteSignals` wholesale and must not delete a Lighthouse block it did not
   * take, but it can also discover that the site has moved — and a page weight
   * measured on the old URL is not a fact about the new one. Storing the URL
   * lets every later reader check for itself instead of trusting the row.
   */
  url: string;
  /** Total transferred bytes for the page and everything it pulls in. */
  totalBytes: number;
  /** Lighthouse's own wording, kept so a person can check the claim as printed. */
  totalBytesLabel: string;
  /** Images served without width and height, which move the page as it loads. */
  unsizedImages: number;
  /** Text that fails the contrast threshold. */
  contrastFailures: number;
  /** Links with no readable name — a screen reader announces nothing. */
  namelessLinks: number;
  unminifiedCssBytes: number;
  unusedJsBytes: number;
  measuredAt: string;
}

export type LighthouseRead =
  | { ok: true; signals: LighthouseSignals }
  | { ok: false; reason: string };

/**
 * Heavy enough to be worth a stranger's attention.
 *
 * A judgement, not a measurement, and flagged as one. The median page is around
 * two and a half megabytes, so three is "noticeably above average" rather than
 * "broken" — and the only prospect this has run against so far was ten and a
 * half, which needs no threshold to argue about.
 */
export const HEAVY_PAGE_BYTES = 3_000_000;

/**
 * Enough failing elements to be a palette rather than a stray caption.
 *
 * Another judgement, and flagged as one. Across the eleven drafted prospects
 * with websites the counts were 49, 40, 16, 8, 7, 1, 1 and four zeroes; the gap
 * sits between eight and sixteen. Ten says a page is built on colours that do
 * not meet the threshold, where one says somebody muted a single line of text.
 *
 * The count itself is solid — three consecutive runs of three sites returned 49,
 * 49, 49 / 40, 40, 40 / 16, 16, 16. It is not quite viewport-independent though:
 * Alta Roofing measures 40 at phone width and 39 on a desktop screen, which is
 * why the fact built from it names the rendering it describes.
 */
export const CONTRAST_FAILURE_FLOOR = 10;

const count = (audit: AuditLike | undefined): number => audit?.details?.items?.length ?? 0;

/** Bytes saveable, taken from `details` — never from `numericValue`, which is ms. */
const savedBytes = (audit: AuditLike | undefined): number =>
  Math.round(audit?.details?.overallSavingsBytes ?? 0);

/**
 * Whether the report describes the business's page or something else.
 *
 * A 403 body is still a page to Lighthouse. It has no unsized images, no
 * contrast failures and almost no bytes, so a refused request measures as a
 * fast, clean, accessible website — a fact about an error page, recorded as a
 * fact about the business. That exact mistake reached a draft about CDW Studios
 * through the HTML enricher, so the same guard is owed here.
 */
function refusal(report: ReportLike): string | null {
  if (report.runtimeError) return `lighthouse could not load the page: ${report.runtimeError.code}`;

  const weight = report.audits["total-byte-weight"];
  if (!weight || typeof weight.numericValue !== "number") {
    return "no total-byte-weight audit in the report";
  }
  // The one audit whose numericValue is genuinely bytes. Checked rather than
  // trusted, so a future Lighthouse that changes the unit is refused instead of
  // storing milliseconds under a name that says bytes.
  if (weight.numericUnit && weight.numericUnit !== "byte") {
    return `total-byte-weight is in ${weight.numericUnit}, not bytes`;
  }

  const status = mainDocumentStatus(report);
  if (status === null) return "no main document request in the report";
  if (status >= 400) return `the site answered ${status}, so nothing here is about their page`;

  return null;
}

/** The HTTP status of the page itself, not of the assets it loads. */
export function mainDocumentStatus(report: ReportLike): number | null {
  const items = report.audits["network-requests"]?.details?.items;
  if (!Array.isArray(items)) return null;

  const target = report.finalDisplayedUrl ?? report.requestedUrl;
  const rows = items as { url?: string; statusCode?: number }[];
  // Lighthouse follows redirects, so the document is matched by URL rather than
  // by being first: the first request on a http:// site is the redirect itself.
  const doc = rows.find((r) => r.url === target) ?? rows[0];
  return typeof doc?.statusCode === "number" ? doc.statusCode : null;
}

export function readLighthouse(report: ReportLike, now = new Date()): LighthouseRead {
  const reason = refusal(report);
  if (reason) return { ok: false, reason };

  const weight = report.audits["total-byte-weight"]!;

  return {
    ok: true,
    signals: {
      url: report.finalDisplayedUrl ?? report.requestedUrl ?? "",
      totalBytes: Math.round(weight.numericValue!),
      totalBytesLabel: weight.displayValue ?? `${Math.round(weight.numericValue! / 1024)} KiB`,
      unsizedImages: count(report.audits["unsized-images"]),
      contrastFailures: count(report.audits["color-contrast"]),
      namelessLinks: count(report.audits["link-name"]),
      unminifiedCssBytes: savedBytes(report.audits["unminified-css"]),
      unusedJsBytes: savedBytes(report.audits["unused-javascript"]),
      measuredAt: now.toISOString(),
    },
  };
}

/**
 * The Lighthouse block out of a prospect's `siteSignals`, if there is one.
 *
 * `siteSignals` is a jsonb column typed `Record<string, unknown>`, so every
 * reader is guessing until something checks. This checks: the two fields any
 * caller depends on must be the right type, or the block is treated as absent.
 * A half-written block that reads as present is how a `undefined KiB` reaches a
 * message.
 */
export function storedLighthouse(signals: unknown): LighthouseSignals | null {
  if (!signals || typeof signals !== "object") return null;
  const block = (signals as Record<string, unknown>).lighthouse;
  if (!block || typeof block !== "object") return null;

  const candidate = block as Partial<LighthouseSignals>;
  if (typeof candidate.url !== "string" || typeof candidate.totalBytes !== "number") return null;
  return candidate as LighthouseSignals;
}

/**
 * Whether a stored reading still describes the site now on the record.
 *
 * Compared by host, not by URL: enrichment rewrites `http://x.com` to
 * `https://www.x.com/` when the site redirects, and that is the same page. A
 * different host is a different business's server, and nothing measured on the
 * old one may be repeated about the new one.
 */
export function measuredOn(signals: Pick<LighthouseSignals, "url">, website: string | null | undefined): boolean {
  const measured = hostOf(signals.url);
  const current = hostOf(website);
  return measured !== null && measured === current;
}

/** Human-readable summary for the CLI. */
export function describe(signals: LighthouseSignals): string[] {
  const lines = [`page weight: ${signals.totalBytesLabel}`];
  if (signals.totalBytes >= HEAVY_PAGE_BYTES) lines.push("  heavy enough to be worth mentioning");
  if (signals.unsizedImages) lines.push(`unsized images: ${signals.unsizedImages}`);
  if (signals.contrastFailures) lines.push(`contrast failures: ${signals.contrastFailures}`);
  if (signals.namelessLinks) lines.push(`links with no name: ${signals.namelessLinks}`);
  if (signals.unminifiedCssBytes) lines.push(`unminified css: ${signals.unminifiedCssBytes} bytes`);
  if (signals.unusedJsBytes) lines.push(`unused javascript: ${signals.unusedJsBytes} bytes`);
  return lines;
}
