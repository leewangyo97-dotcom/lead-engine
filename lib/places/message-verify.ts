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
    reason:
      "says they have no website, and the record does not support that — either " +
      "a site is on file, or their email is at a domain that looks like their own",
  },
  {
    // The honest framing of the same thing. It is not a claim about their
    // business, so it needs no evidence about them — but it still cannot be
    // said to someone whose website is sitting in the record, because then the
    // search did find one and the sentence is a false account of what happened.
    pattern: /\bcould ?n'?o?t find a (?:website|site)\b/i,
    requires: ["no_website", "email_domain"],
    reason: "says the search found no website, and one is on file for them",
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
    // Page weight is measurable and worth raising, but only when it was
    // measured. `pnpm lh` stores it for one prospect at a time and most rows
    // have never been through it, so the default state of this claim is
    // unsupported.
    pattern: /\b(\d+(?:\.\d+)? ?(?:mb|megabytes?|kb)|page ?weight|loads? slowly|slow to load|heavy (?:page|homepage|site))\b/i,
    requires: ["page_weight"],
    reason:
      "says something about how much their page weighs or how slowly it loads, " +
      "and no Lighthouse measurement is on file for them — run `pnpm lh <id>` first",
  },
  {
    // Contrast, readability and accessibility all describe the same measured
    // thing, and none of them is checkable without the measurement. Deliberately
    // narrow: it fires on the claim, not on the topic — offering to improve
    // something is not asserting that it is broken.
    pattern: /\b(contrast|hard to read|difficult to read|illegible|faint text|wcag|screen ?readers?|fails? accessibility|accessibility (?:issues?|problems?|failures?))\b/i,
    requires: ["contrast"],
    reason:
      "says their text is hard to read or their site fails accessibility, and no " +
      "contrast measurement is on file for them — run `pnpm lh <id>` first",
  },
  {
    // The score, specifically. It is not offered as a signal and never will be:
    // the same dentist's site scored 63, then 48, 56 and 52. There is no state
    // of the record that makes this sentence safe, so it is a `never`.
    pattern: /\b(lighthouse|pagespeed|page ?speed|performance score|scores? \d{1,3}\/100|core web vitals)\b/i,
    never: true,
    reason:
      "quotes a performance score or the tool that produced it — measured to move " +
      "fifteen points on one site between two sessions, so it is not a fact about their business",
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
