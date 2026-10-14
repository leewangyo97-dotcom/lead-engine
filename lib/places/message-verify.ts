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
    pattern: /\b(\d+(?:\.\d+)? ?(?:mb|megabytes?|kb)|page ?weight|loads? slowly|opens? slowly|slow to (?:load|open)|heavy (?:page|homepage|site))\b/i,
    requires: ["page_weight"],
    reason:
      "says something about how much their page weighs or how slowly it loads, " +
      "and no Lighthouse measurement is on file for them — run `pnpm lh <id>` first",
  },
  {
    /*
     * Layout shift, and only as a claim about their page.
     *
     * The obvious pattern would be the word "jump", which is also how every
     * other message offers a call — "happy to jump on a call" is in the drafts
     * already. So the subject is required: it is the page, the content, the text
     * or the images that must be said to move, not the word on its own.
     */
    pattern:
      /\b(layout shift|cumulative layout shift|CLS|(?:page|content|text|images?|things?) (?:jumps?|moves?|shifts?|bounces?) (?:around|about|while|as|when|on)|images? (?:have no|with no|without|missing) (?:width|height|dimensions|sizes?))\b/i,
    requires: ["unsized_images"],
    reason:
      "says their page moves or their images have no dimensions, and no such " +
      "measurement is on file for them — run `pnpm lh <id>` first",
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
    // Past work for a client. PROFILE's proof is shipped work it names (ThredUp,
    // ShopGoodwill, Jollibee, JoyRide), and its services are offers. "I built …
    // for" is a client relationship the profile does not hold. Narrow on purpose:
    // "I've worked on", "I'd build" and "I can set up" are not past work for
    // anyone.
    pattern:
      /\bI(?:'ve| have)? (?:built|made|created|designed|set up) (?:a|an|the|their|websites?|sites?|apps?|systems?|assistants?|tools?)\b[^.!?]*\bfor\b/i,
    never: true,
    reason: "claims past work for a business, and PROFILE lists none: its proof is shipped work only",
  },
  {
    // Nothing is agreed before a reply, so no message may name a price, a date
    // or a guarantee. "Free" stays allowed: the offers are free. A deadline is a
    // promise of delivery ("ready this week"), so "happy to jump on a call this
    // week" is left alone.
    pattern:
      /(\$ ?\d|₱ ?\d|\b(?:php|usd|aud) ?\d|\b\d+ ?(?:dollars|pesos|bucks)\b|\bguarantee\w*|\bwithin (?:a|one|two|three|\d+) (?:hours?|days?|weeks?)\b|\b(?:ready|done|live|finished|delivered|launched|built)\b[^.!?]{0,40}?\b(?:in (?:a|one|two|three|\d+) (?:hours?|days?|weeks?)|(?:this|next) week|tomorrow|by (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b)/i,
    never: true,
    reason: "names a price, a deadline or a guarantee, and nothing is agreed before they reply",
  },
  {
    pattern: /\b(here in (?!the Philippines)[A-Z][a-z]+|based here in|local to you|just around the corner|in your area)\b/,
    never: true,
    reason:
      "claims to be local to the business — PROFILE places Joshua in San Jose del Monte, Bulacan",
  },
];

/**
 * AI, only as PROFILE offers it: an assistant that answers common questions and
 * takes bookings or enquiries. Checked per sentence, because the overreach comes
 * in the same breath: "an AI assistant that reads your X-rays". A business that
 * merely has "AI" in its name is not a tool, so the word alone does not fire.
 */
const AI_TOOL = /\b(?:AI[- ]?(?:tools?|assistants?|chat ?bots?|automation|agents?|systems?|powered)|chat ?bots?)\b/i;
const AI_JOB = /\b(?:questions?|bookings?|books?|appointments?|enquir\w*|inquir\w*|quotes?|orders?|reservations?|visits?)\b/i;
// Training and learning are named because PROFILE disqualifies them outright:
// the AI work is AI-assisted development, never models trained on anything.
const AI_OVERREACH = /\b(?:diagnos\w*|x-?rays?|prescri\w*|advice|predict\w*|learn\w*|train\w*|fine-?tun\w*)\b/i;

function aiViolations(message: string): MessageViolation[] {
  return message
    .split(/(?<=[.!?])\s+/)
    .filter((s) =>
      AI_TOOL.test(s)
        ? !/\bassistant\b/i.test(s) || !AI_JOB.test(s) || AI_OVERREACH.test(s)
        : // "An assistant that learns from your bookings" says AI without the
          // word. Only the overreach is held against it, so a sentence about
          // their own dental assistant passes.
          /\bassistants?\b/i.test(s) && AI_OVERREACH.test(s),
    )
    .map((sentence) => ({
      quote: sentence.trim().slice(0, 120),
      reason:
        "offers AI beyond what PROFILE lists — an assistant that answers common " +
        "questions and takes bookings or enquiries",
    }));
}

/** A size a message states, held to the measurement within a megabyte. */
function sizeViolations(message: string, megabytes: number | null | undefined): MessageViolation[] {
  if (megabytes == null) return [];
  return [...message.matchAll(/\b(\d+(?:\.\d+)?) ?(?:mb|megabytes?)\b/gi)]
    .filter((m) => Math.abs(Number(m[1]) - megabytes) > 1)
    .map((m) => ({
      quote: m[0],
      reason: `says ${m[1]} MB, and the measurement is about ${megabytes} MB`,
    }));
}

export function verifyMessage(
  message: string,
  signals: string[],
  facts: { megabytes?: number | null } = {},
): MessageViolation[] {
  const present = new Set(signals);
  const violations: MessageViolation[] = [];
  // A link is an address, not a claim. The demo email's https:// link tripped
  // the security rule on 14 Oct, as if it said something about their site.
  const text = message.replace(/https?:\/\/\S+/g, " ");

  for (const rule of RULES) {
    const match = text.match(rule.pattern);
    if (!match) continue;

    if (rule.never || !rule.requires?.some((s) => present.has(s))) {
      violations.push({ quote: match[0], reason: rule.reason });
    }
  }

  return [...violations, ...aiViolations(text), ...sizeViolations(text, facts.megabytes)];
}
