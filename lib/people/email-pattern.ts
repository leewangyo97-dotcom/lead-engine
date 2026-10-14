/**
 * A company's email format, inferred from addresses it has published.
 *
 * If a company's site shows jane.doe@acme.com for Jane Doe, its other people
 * are probably first.last@acme.com as well. That is the whole method: match
 * known names to known addresses, take the pattern most of them share, and
 * apply it to the names that have no address.
 *
 * Every address made this way is `guessed`. Nothing here can make one
 * `verified`. The only check is that the domain receives mail at all (an MX
 * lookup, see mx.ts). There is no SMTP probing, which mail servers read as an
 * attack and which would put Joshua's Gmail at risk. Guessed addresses are
 * research only (decision of 14 Oct): shown, never copied or sent.
 */

export type Pattern =
  | "first.last"
  | "first"
  | "flast"
  | "firstlast"
  | "first_last"
  | "firstl"
  | "f.last"
  | "last"
  | "last.first";

/** Most common first, which is also the order candidates are offered in. */
export const PATTERNS: Pattern[] = [
  "first.last",
  "first",
  "flast",
  "firstlast",
  "f.last",
  "first_last",
  "firstl",
  "last",
  "last.first",
];

/** Free mailboxes: a person's own, never a business address (guardrail). */
const PERSONAL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.com.au",
  "yahoo.com.ph",
  "ymail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "bigpond.com",
  "optusnet.com.au",
]);

/** Addresses that belong to a desk, not a person. They describe the company. */
const ROLE_LOCAL = /^(info|hello|contact|enquiries|enquiry|inquiries|admin|office|sales|support|team|mail|reception|bookings?|accounts?|billing|careers|jobs|hr|media|press|marketing|help|service|general|noreply|no-reply)$/i;

const HONORIFIC = /^(dr|mr|mrs|ms|miss|prof|sir|dame|atty|engr|eng)\.?$/i;
const SUFFIX = /^(jr|sr|ii|iii|iv|phd|md|cpa|esq)\.?$/i;

const ascii = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

/** First and last name, lower-case ASCII, or null when a name has only one part. */
export function splitName(full: string): { first: string; last: string } | null {
  const parts = full
    .replace(/\(.*?\)|".*?"/g, " ")
    .split(/[\s,]+/)
    .filter((p) => p && !HONORIFIC.test(p) && !SUFFIX.test(p));
  if (parts.length < 2) return null;
  const first = ascii(parts[0]);
  const last = ascii(parts[parts.length - 1]);
  return first && last ? { first, last } : null;
}

export function localPart(name: { first: string; last: string }, pattern: Pattern): string {
  const { first, last } = name;
  switch (pattern) {
    case "first.last":
      return `${first}.${last}`;
    case "first":
      return first;
    case "flast":
      return `${first[0]}${last}`;
    case "firstlast":
      return `${first}${last}`;
    case "first_last":
      return `${first}_${last}`;
    case "firstl":
      return `${first}${last[0]}`;
    case "f.last":
      return `${first[0]}.${last}`;
    case "last":
      return last;
    case "last.first":
      return `${last}.${first}`;
  }
}

const SYNTAX = /^[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/i;

export function isValidSyntax(email: string): boolean {
  return SYNTAX.test(email) && !email.includes("..");
}

export function domainOf(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

export function isPersonalEmail(email: string): boolean {
  return PERSONAL_DOMAINS.has(domainOf(email));
}

export function isRoleAddress(email: string): boolean {
  return ROLE_LOCAL.test(email.split("@")[0] ?? "");
}

/**
 * The pattern most known (name, address) pairs on the domain agree on, with
 * how many agreed. Role addresses and other domains are ignored: info@ says
 * nothing about how people are named.
 */
export function inferPattern(
  known: { name: string; email: string }[],
  domain: string,
): { pattern: Pattern; matches: number } | null {
  const tally = new Map<Pattern, number>();
  for (const { name, email } of known) {
    if (domainOf(email) !== domain.toLowerCase() || isRoleAddress(email)) continue;
    const parts = splitName(name);
    if (!parts) continue;
    const local = email.split("@")[0].toLowerCase();
    // A name can fit two patterns ("first" and "firstl" for a one-letter
    // surname). The first in PATTERNS order wins, which is the commoner one.
    const fit = PATTERNS.find((p) => localPart(parts, p) === local);
    if (fit) tally.set(fit, (tally.get(fit) ?? 0) + 1);
  }
  let best: { pattern: Pattern; matches: number } | null = null;
  for (const [pattern, matches] of tally) {
    if (!best || matches > best.matches) best = { pattern, matches };
  }
  return best;
}

/**
 * The address a name would have under the company's pattern, or null when
 * the pattern is unknown or the name too short to apply it. One guess, not a
 * list: a list of guesses is how addresses get spammed in turn.
 */
export function guessEmail(name: string, domain: string, pattern: Pattern | null): string | null {
  if (!pattern) return null;
  const parts = splitName(name);
  if (!parts) return null;
  const email = `${localPart(parts, pattern)}@${domain.toLowerCase()}`;
  return isValidSyntax(email) ? email : null;
}
