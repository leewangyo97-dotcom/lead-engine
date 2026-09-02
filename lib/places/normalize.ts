/**
 * Identity helpers for cross-search deduplication.
 *
 * Two searches over overlapping areas return the same clinic, and a chain's
 * branches share one website. Without these, "Cebu City" and "Philippines"
 * produce two copies of every business between them, and the owner emails the
 * same practice twice.
 */

/** Legal and generic suffixes that carry no identity. */
const NOISE_WORDS = [
  "inc",
  "incorporated",
  "corp",
  "corporation",
  "co",
  "company",
  "ltd",
  "limited",
  "llc",
  "llp",
  "plc",
  "gmbh",
  "bv",
  "pte",
  "sdn",
  "bhd",
  "the",
];

/**
 * A comparable form of a business name.
 *
 * Deliberately does NOT strip category words like "clinic" or "school": two
 * genuinely different businesses can share a base name where one is a clinic and
 * the other a pharmacy, and collapsing those would merge unrelated leads. Only
 * legal-form noise goes.
 */
export function normalizeName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !NOISE_WORDS.includes(w))
    .join(" ");

  return cleaned.trim();
}

/** Public suffixes needing two labels kept, e.g. `example.com.ph`. */
const TWO_LEVEL_TLDS = new Set([
  "com.ph",
  "com.au",
  "co.uk",
  "org.uk",
  "co.jp",
  "com.br",
  "com.sg",
  "co.nz",
  "com.my",
]);

/**
 * The registrable domain, so two branches of one chain collapse to one lead.
 *
 * Returns null rather than guessing when the input is not a usable URL — a bad
 * value here would silently merge unrelated businesses under a shared key.
 */
export function rootDomain(website: string | null | undefined): string | null {
  if (!website) return null;

  let host: string;
  try {
    const withScheme = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    host = new URL(withScheme).hostname.toLowerCase();
  } catch {
    return null;
  }

  host = host.replace(/^www\./, "");
  const parts = host.split(".").filter(Boolean);
  if (parts.length < 2) return null;

  const lastTwo = parts.slice(-2).join(".");
  if (TWO_LEVEL_TLDS.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return lastTwo;
}
