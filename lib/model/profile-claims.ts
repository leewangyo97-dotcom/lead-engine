/**
 * Checking the numbers in a draft against PROFILE.md.
 *
 * The model verifier reads a draft and judges it, which works and costs a call.
 * This is the cheap deterministic half: every figure a message quotes about
 * Joshua — a percentage, a count, a span of years — has to appear in the file
 * that is allowed to make claims about him. An invented metric is the most
 * damaging thing an outreach email can contain and the easiest to check.
 *
 * Only figures. Judging prose is the model's job; this refuses to guess.
 */

export interface ClaimViolation {
  quote: string;
  reason: string;
}

/**
 * Numbers that carry no claim about Joshua.
 *
 * Years of a date, ordinary small counts, and the numerals inside a stack name
 * ("Tencent IM 3.x", "Material 3") are not achievements, and flagging them would
 * teach the reader to ignore this check.
 */
const IGNORABLE = /^(19|20)\d{2}$|^[0-9]$|^1[0-2]$/;

/**
 * Figures worth checking: percentages, thousands, spans of years, and any bare
 * number of three digits or more.
 *
 * `skipSmall` marks the patterns where a small number is meaningless noise. A
 * span of years is a claim however small — "7 years" and "17 years" describe
 * different people — so that pattern keeps its numbers.
 */
const CLAIM_PATTERNS: { re: RegExp; skipSmall: boolean }[] = [
  { re: /\b\d{1,3}(?:\.\d+)?%/g, skipSmall: false },
  { re: /\b\d{1,3}(?:,\d{3})+\b/g, skipSmall: false },
  { re: /\b\d+\+?\s*(?:years?|yrs?)\b/gi, skipSmall: false },
  { re: /\b\d{3,}\+?\b/g, skipSmall: true },
];

/** Digits only, so "3,000+" in a draft matches "3,000" in PROFILE. */
function digits(value: string): string {
  return value.replace(/[^\d]/g, "");
}

export function extractClaims(text: string): string[] {
  const found = new Set<string>();
  for (const { re, skipSmall } of CLAIM_PATTERNS) {
    for (const match of text.matchAll(re)) {
      const raw = match[0].trim();
      if (skipSmall && IGNORABLE.test(digits(raw))) continue;
      // A calendar year is never an achievement, whichever pattern found it.
      if (/^(19|20)\d{2}$/.test(digits(raw)) && !raw.includes("%")) continue;
      found.add(raw);
    }
  }
  return [...found];
}

/**
 * Every figure in the draft must appear in the profile.
 *
 * Compared on digits alone: a draft may write "3,000+" where the profile writes
 * "3,000", and "35%" must still find "35" in a sentence about cutting the crash
 * rate. That is looser than matching the exact string and tighter than trusting
 * the writer, which is the balance a pre-send check wants.
 */
export function verifyClaims(draft: string, profile: string): ClaimViolation[] {
  // Only the profile's own claim-shaped figures count as permission. Reading
  // every number in the file would let an example rate like "$45-70/hr"
  // legitimise "cut crashes by 45%", which is exactly the substitution this
  // check exists to catch.
  const profileDigits = new Set(extractClaims(profile).map(digits));

  return extractClaims(draft)
    .filter((claim) => !profileDigits.has(digits(claim)))
    .map((claim) => ({
      quote: claim,
      reason: "figure does not appear in PROFILE.md, which is the only source of claims about him",
    }));
}

/**
 * Places the drafts keep reaching for, so a claim about where he is can be
 * checked against the file that decides it.
 *
 * "Manila" is the one that actually happened: an application went out saying
 * "based in Manila" three times — subject, body and signature — while PROFILE.md
 * says San Jose del Monte, Bulacan. It is Greater Manila and it is the useful
 * answer for a recruiter thinking about timezones, but it is not what the
 * profile says, and a reader comparing the email to a CV sees the difference.
 *
 * Only shorthand for somewhere he might plausibly be claimed to live. A draft
 * mentioning the employer's city is not making a claim about him, which is why
 * this list is short and local rather than every place name in the world.
 */
const CLAIMABLE_PLACES = [
  "Manila",
  "Metro Manila",
  "Makati",
  "Quezon City",
  "Taguig",
  "BGC",
  "Pasig",
  "Mandaluyong",
  "Cebu",
  "Cebu City",
  "Davao",
  "Bulacan",
  "San Jose del Monte",
];

/**
 * Rejects a location the profile does not support.
 *
 * Matched only where the draft is saying this is where *he* is — "based in",
 * "I'm in", or a signature line — so quoting an employer's office location stays
 * allowed.
 */
export function verifyLocation(draft: string, profile: string): ClaimViolation[] {
  const violations: ClaimViolation[] = [];

  for (const place of CLAIMABLE_PLACES) {
    if (profile.includes(place)) continue;

    // String.raw, because in an ordinary template literal `\s` collapses to "s"
    // and `\b` becomes a backspace character — which is how the first version of
    // this check silently matched nothing at all.
    const claim = new RegExp(
      String.raw`(based in|I'?m in|I am in|located in|writing from|Developer · |Developer - )\s*` +
        place +
        String.raw`\b`,
      "i",
    );
    const match = draft.match(claim);
    if (match) {
      violations.push({
        quote: match[0].trim(),
        reason: `PROFILE.md does not place him in ${place} — write "the Philippines", or "San Jose del Monte, Bulacan"`,
      });
    }
  }

  return violations;
}