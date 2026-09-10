/**
 * What a draft asserts about a business's website, so it can be checked against
 * the website.
 *
 * Two of nineteen drafts written on 10 September were false. One told CDW
 * Studios their site has no viewport tag and no contact details — it has both,
 * and the signals had been measured on a 403 error body. One told Leura Wellness
 * they have no website — they have one, at the domain in their own email
 * address.
 *
 * Both were caught by opening the site. Nothing in the pipeline did that, and
 * `verifyMessage` cannot: it checks a message against the stored signals, so a
 * message faithful to a wrong record passes. This names the claims worth
 * checking against reality instead.
 *
 * Deliberately narrow. A claim belongs here only if fetching one page settles
 * it — "you have no website" and "your site has no viewport tag" do; "most
 * people search on Google first" does not, and no amount of fetching would make
 * it checkable.
 */
export type ClaimKind = "no-website" | "no-viewport" | "no-contact-details";

export interface Claim {
  kind: ClaimKind;
  /** The wording, so a report can point at it. */
  quote: string;
}

interface Detector {
  kind: ClaimKind;
  pattern: RegExp;
}

const DETECTORS: Detector[] = [
  {
    kind: "no-website",
    pattern:
      /\b(?:don'?t|do not) have a (?:website|site)\b|\bwithout a (?:website|site)\b|\bno website\b|\bhaven'?t got a (?:website|site)\b/i,
  },
  {
    kind: "no-viewport",
    // How the site behaves on a phone: only checkable when a viewport tag was
    // measured, and measuring it is exactly what went wrong.
    pattern:
      /\bno viewport\b|\bviewport tag\b|\bdesktop width\b|\bpinch to (?:read|zoom)\b|\bdoes not adapt\b|\bdoesn'?t adapt\b/i,
  },
  {
    kind: "no-contact-details",
    pattern:
      /\bno contact detail\w*\b|\bno way to (?:contact|reach) you\b|\blists no contact\b|\bcontact details? anywhere\b/i,
  },
];

export function claimsOf(message: string): Claim[] {
  const found: Claim[] = [];
  const seen = new Set<ClaimKind>();

  for (const detector of DETECTORS) {
    const match = message.match(detector.pattern);
    // One claim per kind: a message saying the same thing twice is one thing to
    // check, and a report listing it twice reads as two problems.
    if (!match || seen.has(detector.kind)) continue;
    seen.add(detector.kind);
    found.push({ kind: detector.kind, quote: match[0] });
  }

  return found;
}

/** True when a claim can only be settled by fetching the site itself. */
export function needsFetch(claims: readonly Claim[]): boolean {
  return claims.some((c) => c.kind === "no-viewport" || c.kind === "no-contact-details");
}
