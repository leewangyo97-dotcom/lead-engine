import { normalizeName } from "./normalize";

/**
 * Whether a business's email address implies a website this record does not know
 * about.
 *
 * A draft went out for review telling Leura Wellness they have no website. Their
 * email is at `leurawellness.com.au`, and that domain serves a 349KB site titled
 * "Leura Wellness". The record said no website because OpenStreetMap has no
 * website tag for them — which is a fact about OpenStreetMap, not about the
 * business.
 *
 * The naive rule, "a non-free email domain means they have a site", is too
 * strong: of 117 such prospects, many are at `deped.gov.ph` or `unsw.edu.au` —
 * a department's domain or a university's, not the school's or the clinic's, and
 * those businesses genuinely have no site of their own.
 *
 * What separates the two is resemblance. `leurawellness.com.au` is Leura
 * Wellness; `deped.gov.ph` is not Tangke Elementary School. So this compares the
 * normalised business name against the domain's own label and answers only when
 * they overlap.
 */

/** Free and ISP mail providers: an address here says nothing about a website. */
const SHARED_MAIL = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.com.ph",
  "ymail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  // Australian and Philippine ISP mailboxes, which behave like free providers.
  "bigpond.com",
  "bigpond.net.au",
  "optusnet.com.au",
  "iinet.net.au",
  "pldtdsl.net",
]);

/** The shortest overlap worth trusting; below this, coincidence is likely. */
const MIN_OVERLAP = 5;

export function domainOf(email: string | null | undefined): string | null {
  const at = email?.lastIndexOf("@") ?? -1;
  if (!email || at < 1) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain.includes(".") ? domain : null;
}

/**
 * The domain a business appears to own, or null.
 *
 * Compared on letters only: "Leura Wellness" and "leurawellness.com.au" share
 * `leurawellness` once spaces and punctuation are gone, and `normalizeName`
 * already does that job for cross-search dedupe.
 */
export function ownDomainFromEmail(
  name: string,
  email: string | null | undefined,
): string | null {
  const domain = domainOf(email);
  if (!domain || SHARED_MAIL.has(domain)) return null;

  const label = domain.split(".")[0].replace(/[^a-z0-9]/g, "");
  const compact = normalizeName(name).replace(/[^a-z0-9]/g, "");
  if (label.length < MIN_OVERLAP || compact.length < MIN_OVERLAP) return null;

  // Either direction: a domain may abbreviate the name, or carry more than it.
  return label.includes(compact) || compact.includes(label) ? domain : null;
}
