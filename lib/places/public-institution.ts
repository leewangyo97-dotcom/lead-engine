/**
 * Whether a prospect is a public body (a government office, a public school or
 * school system, a public health service), told by its email domain.
 *
 * Not a prospect, on any channel. They do not hire a freelancer from a cold
 * message, and their mail servers are built to stop exactly this. On 14 Oct
 * Angurugu Health Centre (nt.gov.au) bounced the first email as "Suspect Spam",
 * and every bounce counts against the Gmail account that sends everything else.
 * 2,903 of the 4,422 prospects with an email were such addresses, 2,231 of them
 * NSW public schools (det.nsw.edu.au).
 *
 * By domain, because that is the one thing OpenStreetMap gets right about who
 * runs a place. A ".org" proves nothing either way, so it is left alone.
 */
const PUBLIC_DOMAIN =
  /(?:^|\.)(?:gov|edu|mil)(?:\.[a-z]{2})?$|(?:^|\.)nhs\.(?:uk|net)$|(?:^|\.)k12\.[a-z]{2}\.us$/i;

/** The public body's domain, or null when the address is not one. */
export function publicDomain(email: string | null | undefined): string | null {
  const domain = email?.split("@")[1]?.trim().toLowerCase();
  return domain && PUBLIC_DOMAIN.test(domain) ? domain : null;
}

/** Why the row offers no way to contact them, shown where the buttons were. */
export function publicReason(domain: string): string {
  return `public body (${domain}): they do not hire this way, and their mail servers block cold email`;
}
