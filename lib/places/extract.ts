import { toE164 } from "./phone";

/**
 * Pulling contact details out of a business homepage.
 *
 * Everything here is pure and takes HTML as a string, which is what makes the
 * false-positive rules testable — and false positives are the whole problem. A
 * regex over page text finds tracking pixels, image filenames and the theme
 * author's address long before it finds the vet's inbox.
 */

/** Addresses that are never the business's own. */
const JUNK_EMAIL = [
  "example@",
  "your@email",
  "email@example",
  "user@domain",
  "sentry",
  "wixpress",
  "@sentry.io",
  "godaddy",
  "squarespace",
  "@2x",
  "no-reply@",
  "noreply@",
];

/** Image and asset extensions that a naive regex reads as a domain. */
const ASSET_SUFFIX = /\.(png|jpe?g|webp|gif|svg|ico|css|js|woff2?)$/i;

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export interface ExtractedEmail {
  email: string;
  confidence: "mailto" | "text";
}

export function extractEmails(html: string): ExtractedEmail[] {
  const found = new Map<string, "mailto" | "text">();

  // A mailto: href is the business stating its own address. Anything scraped
  // from body text is a guess by comparison, so confidence is recorded.
  for (const m of html.matchAll(/mailto:([^"'?>\s]+)/gi)) {
    const email = decodeURIComponent(m[1]).trim().toLowerCase();
    if (isUsableEmail(email)) found.set(email, "mailto");
  }

  const text = stripTags(html);
  for (const m of text.matchAll(EMAIL_RE)) {
    const email = m[0].trim().toLowerCase();
    if (isUsableEmail(email) && !found.has(email)) found.set(email, "text");
  }

  return [...found].map(([email, confidence]) => ({ email, confidence }));
}

export function isUsableEmail(email: string): boolean {
  const lower = email.toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(lower)) return false;
  if (ASSET_SUFFIX.test(lower)) return false;
  if (JUNK_EMAIL.some((j) => lower.includes(j))) return false;
  // "2x@" and similar come from srcset attributes rather than people.
  if (/^\d+x@/.test(lower)) return false;
  return true;
}

/**
 * A wa.me or api.whatsapp.com link is the strongest signal on the page: the
 * business has published a number it actively uses for WhatsApp, which is a
 * different claim from merely having a phone.
 */
export function extractWhatsApp(html: string, country?: string | null): string | null {
  const patterns = [
    /wa\.me\/(\+?\d{6,15})/i,
    /api\.whatsapp\.com\/send\?phone=(\+?\d{6,15})/i,
    /web\.whatsapp\.com\/send\?phone=(\+?\d{6,15})/i,
  ];

  for (const re of patterns) {
    const m = html.match(re);
    if (m) {
      const raw = m[1].startsWith("+") ? m[1] : `+${m[1]}`;
      const e164 = toE164(raw, country);
      if (e164) return e164;
    }
  }
  return null;
}

export function extractPhones(html: string, country?: string | null): string[] {
  const out = new Set<string>();

  for (const m of html.matchAll(/tel:([+0-9()\-.\s]{6,25})/gi)) {
    const e164 = toE164(m[1], country);
    if (e164) out.add(e164);
  }

  // Text patterns are noisier — dates and prices look like numbers — so they
  // only count when libphonenumber agrees they are a real number.
  const text = stripTags(html);
  for (const m of text.matchAll(/\+?\d[\d\s().-]{7,18}\d/g)) {
    const e164 = toE164(m[0], country);
    if (e164) out.add(e164);
  }

  return [...out];
}

export interface Socials {
  facebook?: string;
  instagram?: string;
  linkedin?: string;
}

export function extractSocials(html: string): Socials {
  const grab = (re: RegExp) => html.match(re)?.[0];
  return {
    facebook: grab(/https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9._-]{2,}/i),
    instagram: grab(/https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._-]{2,}/i),
    linkedin: grab(/https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[A-Za-z0-9._-]{2,}/i),
  };
}

/**
 * Signals a software engineer can honestly pitch against.
 *
 * Each is an observable fact about the page, not an opinion — "no viewport meta"
 * is checkable, "looks dated" is not, and only the first belongs in an email.
 */
export interface SiteSignals {
  noViewport: boolean;
  noHttps: boolean;
  hasBookingForm: boolean;
  platform?: "wordpress" | "wix" | "squarespace" | "shopify";
}

export function extractSiteSignals(html: string, url: string): SiteSignals {
  const lower = html.toLowerCase();
  return {
    noViewport: !/<meta[^>]+name=["']viewport["']/i.test(html),
    noHttps: url.startsWith("http://"),
    hasBookingForm: /\b(book|appointment|schedule|reserve|booking)\b/i.test(stripTags(html)),
    platform: lower.includes("wp-content")
      ? "wordpress"
      : lower.includes("wix.com") || lower.includes("wixstatic")
        ? "wix"
        : lower.includes("squarespace")
          ? "squarespace"
          : lower.includes("cdn.shopify")
            ? "shopify"
            : undefined,
  };
}

/** Removes scripts, styles and tags so text extraction sees what a reader sees. */
export function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

/**
 * Hosts and phrases that mean the domain is parked or for sale.
 *
 * Found by following a clinic's OpenStreetMap link to a HugeDomains listing: the
 * business let its domain lapse. Treating that page as "their website" would
 * have us admire a site that no longer exists, when the truthful and far better
 * opening is that their domain is gone.
 */
const PARKED_HOSTS = [
  "hugedomains.com",
  "sedo.com",
  "afternic.com",
  "dan.com",
  "domainmarket.com",
  "buydomains.com",
  "undeveloped.com",
  "parkingcrew.net",
  "sedoparking.com",
  "bodis.com",
];

const PARKED_TEXT =
  /(this domain (?:name )?is for sale|buy this domain|the domain .{0,40} is for sale|domain parking|inquire about this domain)/i;

export function isParkedDomain(finalUrl: string, html: string): boolean {
  let host = "";
  try {
    host = new URL(finalUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (PARKED_HOSTS.some((p) => host === p || host.endsWith(`.${p}`))) return true;
  // Only the head of the page: a long article mentioning domain sales is not one.
  return PARKED_TEXT.test(stripTags(html).slice(0, 1500));
}
