/**
 * Turning whatever OpenStreetMap holds for a social account into a link.
 *
 * `contact:facebook` legitimately carries any of a full URL, a bare domain path,
 * or just the page handle — 81 of 638 stored values are handles like
 * `@manimokocebu`, `cdwstudios` or `metrosports.lahug`. Stored raw they are dead
 * links: the row shows something, clicking it goes nowhere.
 *
 * They are recoverable, which is the point. A handle is the last path segment of
 * the URL it belongs to, so the only thing missing is the part that never varies.
 *
 * The opposite failure is worth guarding too. Scraping a page for the first
 * facebook.com URL finds share buttons and tracking pixels long before it finds
 * the business — `facebook.com/sharer/sharer.php?u=…` matches any naive pattern
 * and belongs to whoever clicked it, not to the business.
 */
export type Network = "facebook" | "instagram" | "linkedin";

const HOSTS: Record<Network, string> = {
  facebook: "www.facebook.com",
  instagram: "www.instagram.com",
  linkedin: "www.linkedin.com",
};

/**
 * Path prefixes that belong to the platform rather than to any business.
 *
 * Per network, because the same segment means opposite things: `/p/` is a post
 * on Instagram and a **page** on Facebook — `facebook.com/p/Bonenone-Korean-
 * Chicken-100091435368532` is a real business page in this table. One shared
 * list would have cleared 89 live links, which a dry run caught before it wrote
 * anything.
 */
const SHARED_NOT_A_PROFILE = [
  "sharer",
  "share",
  "share.php",
  "dialog",
  "plugins",
  "tr",
  "login",
  "help",
  "policy",
  "policies",
  "privacy",
  "terms",
  "profile.php",
  "people",
  "groups",
  "events",
  "hashtag",
  "explore",
  "accounts",
  "feed",
  "home",
  "search",
  "intent",
];

/** Instagram alone: these are content, not accounts. */
const NOT_A_PROFILE: Record<Network, string[]> = {
  facebook: SHARED_NOT_A_PROFILE,
  instagram: [...SHARED_NOT_A_PROFILE, "p", "reel", "reels", "stories", "tv"],
  linkedin: SHARED_NOT_A_PROFILE,
};

/** A handle: letters, digits, dots, dashes and underscores, no slashes. */
const HANDLE = /^@?[A-Za-z0-9._-]{2,}$/;

export function normaliseSocial(network: Network, raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;

  if (HANDLE.test(value)) {
    const handle = value.replace(/^@/, "");
    // A bare word that is really a platform path is not a business page.
    if (NOT_A_PROFILE[network].includes(handle.toLowerCase())) return null;
    return `https://${HOSTS[network]}/${handle}`;
  }

  // Anything else has to parse as a URL on the right host. `//` and a missing
  // scheme are both common in OSM values and in href attributes.
  const candidate = value.startsWith("http")
    ? value
    : `https://${value.replace(/^\/\//, "")}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^m\./, "").replace(/^www\./, "");
  const expected = HOSTS[network].replace(/^www\./, "");
  // fb.com is Facebook's own shortener and appears in the wild.
  const matches = host === expected || (network === "facebook" && host === "fb.com");
  if (!matches) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  if (!segments.length) return null;

  // LinkedIn profiles live under /company/ or /in/, so the meaningful segment is
  // the second one; everywhere else it is the first.
  const lead = segments[0].toLowerCase();
  if (network === "linkedin") {
    if (!["company", "in", "school"].includes(lead) || !segments[1]) return null;
    return `https://${HOSTS[network]}/${lead}/${segments[1]}`;
  }

  if (NOT_A_PROFILE[network].includes(lead)) return null;

  // Facebook writes pages two ways, and both carry the identifier in the second
  // segment: the newer /p/<name-id> and the older /pages/<name>/<id>. Bare
  // `/pages` or `/p` with nothing after it is the platform, not a business.
  if (network === "facebook" && (lead === "p" || lead === "pages")) {
    if (!segments[1]) return null;
    const rest = lead === "pages" ? segments.slice(1, 3).join("/") : segments[1];
    return `https://${HOSTS[network]}/${lead}/${rest}`;
  }

  return `https://${HOSTS[network]}/${segments[0]}`;
}
