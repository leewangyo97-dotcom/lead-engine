/**
 * Checking an outreach message against the facts behind it.
 *
 * `apply:enhance` already refuses a message that claims a signal the prospect
 * does not have. That was not enough: a message can declare an honest signal and
 * still say something untrue in its text, which is exactly what happened — a
 * draft told a dentist her site was insecure while declaring signals that were
 * all real.
 *
 * So this reads the words. Each rule names a claim the text makes and the signal
 * that would have to be present for it to be true. It is deliberately narrow:
 * every rule here corresponds to a claim these messages actually make, and a
 * rule that fires on innocent wording is worse than no rule, because it trains
 * you to pass the `--force` flag.
 */

export interface MessageViolation {
  /** The wording that triggered the rule, so it can be found and fixed. */
  quote: string;
  reason: string;
}

interface Rule {
  pattern: RegExp;
  /** The message may make this claim only if one of these signals is present. */
  requires?: string[];
  /** Or it may never make it, whatever the signals say. */
  never?: boolean;
  reason: string;
}

const RULES: Rule[] = [
  {
    pattern: /\b(not secure|insecure|plain http|without https|no https|https)\b/i,
    requires: ["no_https"],
    reason:
      "says something about the site's security, which is only true when the site was measured as serving plain http",
  },
  {
    pattern: /\b(don'?t have a (?:website|site)|no website|without a website|haven'?t got a (?:website|site))\b/i,
    requires: ["no_website"],
    reason: "says they have no website, and the record says they have one",
  },
  {
    pattern: /\b(your (?:website|site)|you already have a (?:website|site))\b/i,
    requires: ["website"],
    reason: "refers to their website, and the record has none",
  },
  {
    pattern: /\b(on (?:my|a) phone|mobile[- ]friendly|on mobile|phone screen|responsive)\b/i,
    requires: ["no_viewport", "no_website"],
    reason:
      "comments on how the site behaves on a phone, which is only checkable when a viewport tag was measured missing",
  },
  {
    pattern: /\b(reviews?|ratings?|testimonials?|stars on google)\b/i,
    never: true,
    reason: "mentions reviews or ratings, which this project never collects",
  },
  {
    pattern: /\b(opening hours|you'?re open|open (?:until|till|from)|closing time)\b/i,
    never: true,
    reason: "claims to know their opening hours, which are not in the record",
  },
  {
    pattern: /\b(your customers told|i (?:visited|stopped by|walked past|came by|saw your shop))\b/i,
    never: true,
    reason: "claims a visit or a conversation that did not happen",
  },
  {
    pattern: /\b(here in (?!the Philippines)[A-Z][a-z]+|based here in|local to you|just around the corner|in your area)\b/,
    never: true,
    reason:
      "claims to be local to the business — PROFILE places Joshua in San Jose del Monte, Bulacan",
  },
];

export function verifyMessage(message: string, signals: string[]): MessageViolation[] {
  const present = new Set(signals);
  const violations: MessageViolation[] = [];

  for (const rule of RULES) {
    const match = message.match(rule.pattern);
    if (!match) continue;

    if (rule.never || !rule.requires?.some((s) => present.has(s))) {
      violations.push({ quote: match[0], reason: rule.reason });
    }
  }

  return violations;
}
