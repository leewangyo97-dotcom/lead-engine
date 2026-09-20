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
 * Deliberately narrow. A claim belongs here only if something can settle it:
 * "you have no website" and "your site has no viewport tag" are settled by one
 * fetch; "most people search on Google first" is settled by nothing, and no
 * amount of fetching would make it checkable.
 *
 * The measured kinds below are the second sort: real assertions that one fetch
 * cannot settle. A homepage's total weight includes subresources this project
 * never downloads, and contrast needs the page rendered. They are named anyway,
 * because the alternative was worse — a draft saying "your homepage loads 6.2
 * MB" carried no kind at all, so it was reported as *making no claim*, which is
 * the same false comfort `no-claims` exists to prevent, one level up. What they
 * need is not a fetch but a fresh `pnpm lh`.
 */
export type ClaimKind =
  | "no-website"
  | "no-viewport"
  | "no-contact-details"
  | "page-weight"
  | "contrast"
  | "unsized-images";

/** Kinds that only a new Lighthouse run can settle. */
const MEASURED: ReadonlySet<ClaimKind> = new Set<ClaimKind>([
  "page-weight",
  "contrast",
  "unsized-images",
]);

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
  {
    kind: "page-weight",
    // A size in megabytes is the whole claim. Kilobytes are not matched: nothing
    // in `enhance.ts` offers a weight below the 3 MB floor, so a draft talking
    // in KB is talking about something else.
    pattern: /\b\d+(?:\.\d+)?\s?(?:MB|megabytes?)\b/i,
  },
  {
    kind: "contrast",
    pattern:
      /\blow[-\s]contrast\b|\bcontrast (?:threshold|ratio|check)\b|\bfail(?:s|ed|ing)?\s+(?:the\s+)?contrast\b|\bcontrast\b[^.]{0,30}\bfail\w*\b/i,
  },
  {
    kind: "unsized-images",
    pattern:
      /\bunsized images?\b|\bimages?\b[^.]{0,30}\bno (?:width|height|dimensions)\b|\bno width (?:or|and) height\b|\breserves? no space\b/i,
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

/**
 * Claims a fetch cannot settle, only a fresh measurement can.
 *
 * Kept separate from `needsFetch` on purpose: these must not pull a site down
 * the wire. Fetching a page proves nothing about its total weight, and a check
 * that cannot fail is worse than no check — it would print "ok" beside every
 * one of them.
 */
export function measuredClaims(claims: readonly Claim[]): Claim[] {
  return claims.filter((c) => MEASURED.has(c.kind));
}
