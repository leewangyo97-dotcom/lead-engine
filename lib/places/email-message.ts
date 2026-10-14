import {
  CONTRAST_FAILURE_FLOOR,
  HEAVY_PAGE_BYTES,
  UNSIZED_IMAGE_FLOOR,
  measuredOn,
  storedLighthouse,
} from "./lighthouse-signals";

/**
 * The first email to a local business: subject and body.
 *
 * WhatsApp keeps `firstMessage` — three lines read on a phone between customers.
 * An email is read at a desk and can carry the four things a cold pitch needs
 * (asked for on 13 Oct, after the Superpath freelancer templates and a list of
 * what wins freelance work): something specific about *them*, the problem in
 * plain words with a concrete example, proof that can be checked, and one small
 * question that is easy to say yes to.
 *
 * Written for an owner who is not technical. No jargon: "heavy" and "slow to
 * open", not page weight; "hard to read", not contrast ratio.
 *
 * **Every sentence is held to `verifyMessage`.** A finding is named only when it
 * was measured on this business's own site — the same floors the `/prospects`
 * findings use — and "couldn't find a website" only when none is on file. The
 * proof line names only shipped work from PROFILE.md — the ThredUp and ShopGoodwill
 * sites, the Jollibee and JoyRide apps. It first said "I built the website for
 * Majar Funeral Service"; the verifier caught that PROFILE lists Majar as his own
 * project, not a client's. Nothing here claims a visit, a review, their hours or
 * what their customers think; the checker refuses all four.
 */
export interface EmailPlace {
  /** Decides the prospect's half of the subject-line test (`abVariant`). */
  id?: string;
  name: string;
  category: string;
  city: string | null;
  website: string | null;
  siteSignals: unknown;
  /** Their published demo page (lib/demo), when one exists. */
  demoUrl?: string | null;
}

export interface Email {
  subject: string;
  body: string;
  /** What /review groups replies by: the email's kind and its subject variant. */
  angle?: string;
}

export const SIGNATURE = [
  "—",
  "Joshua Senining",
  "Web and app developer · the Philippines",
  "WhatsApp +63 915 858 7388",
].join("\n");

/**
 * Who he is and what can be checked — every claim in PROFILE.md.
 *
 * The signature above is the outreach one in plain words: an owner does not know
 * what "Full Stack" or "UTC+8" means, and neither changes their answer. The
 * portfolio link appears once, here. The signature repeated it until 13 Oct, and
 * one link reads less like a mass mailing than two.
 */
export const PROOF =
  "I'm Joshua, a web and app developer in the Philippines. I've worked on websites " +
  "like ThredUp and ShopGoodwill and apps like Jollibee and JoyRide — you can see " +
  "my work at joshuasenining.dev.";

/**
 * Every email ends with a way out (13 Oct). Someone who cannot say no says it
 * with the Report spam button instead, and each report counts against the Gmail
 * account that sends everything else. Australia's Spam Act asks for an
 * unsubscribe in commercial email too, and most of the list is Australian. A
 * reply of "no" is that unsubscribe: "they said no" puts the business on the
 * do-not-contact list.
 */
export const OPT_OUT = `Not interested? Reply "no" and I won't email you again.`;

/** The portfolio, for an accepted draft that does not link it already. */
const PORTFOLIO = "You can see my work at joshuasenining.dev.";

/** What one of these is called in a sentence: "the next clinic on the list". */
const NOUN: Record<string, string> = {
  clinics: "clinic",
  dentists: "dentist",
  veterinary: "vet",
  veterinaryHospitals: "vet hospital",
  pharmacies: "pharmacy",
  restaurants: "restaurant",
  cafes: "café",
  gyms: "gym",
  salons: "salon",
  lawFirms: "law firm",
  accountants: "accountant",
  realEstate: "real estate agent",
  hotels: "hotel",
  autoRepair: "auto repair shop",
  contractors: "contractor",
  trades: "tradesperson",
  eventServices: "event service",
  professionalServices: "firm",
  childcare: "childcare centre",
  medicalSpecialists: "specialist",
  foodProducers: "food business",
  schools: "school",
};

export function nounFor(category: string): string {
  return NOUN[category] ?? "business";
}

/**
 * "an accountant", "a dentist". Every noun above that starts with a vowel letter
 * starts with a vowel sound, so the letter decides. "a accountant" went out in
 * every no-website email to an accountant, auto repair shop or event service
 * until the verifier read one on 13 Oct.
 */
export function withArticle(noun: string): string {
  return `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
}

/**
 * What an assistant would do for this kind of business, finishing "answers common
 * questions and ...". Worded per kind: "books appointments" is right for a dentist
 * and wrong for a restaurant.
 */
const TASK: Record<string, string> = {
  restaurants: "takes table bookings",
  cafes: "takes table bookings",
  hotels: "takes room bookings",
  foodProducers: "passes the rest on to you",
  pharmacies: "passes the rest on to you",
  contractors: "collects quote requests",
  trades: "collects quote requests",
  autoRepair: "books service appointments",
  realEstate: "books property visits",
  eventServices: "takes event bookings",
  childcare: "books visits for parents",
  // Schools take the default: the category holds driving schools too, where
  // "visits for parents" read wrong on 13 Oct.
  gyms: "books trial classes",
};

export function taskFor(category: string): string {
  return TASK[category] ?? "books appointments";
}

/**
 * The one line that offers more than the website. Asked for on 13 Oct, "AI
 * automation and so on". It is an offer and never past work: PROFILE lists it
 * under services, not under anything shipped.
 */
export function toolsLine(category: string): string {
  return (
    `I can also set up simple AI tools that save you time, like an assistant that ` +
    `answers common questions and ${taskFor(category)}, day or night.`
  );
}

type Finding =
  | { kind: "heavy"; megabytes: number }
  | { kind: "contrast" }
  | { kind: "unsized" };

/**
 * The one measured problem worth leading with, or null.
 *
 * One, not a list: a list reads as an audit, and an audit reads as a pitch. Weight
 * first, because a slow page loses people before they read anything at all.
 */
export function findingOf(place: Pick<EmailPlace, "website" | "siteSignals">): Finding | null {
  const lh = storedLighthouse(place.siteSignals);
  if (!lh || !measuredOn(lh, place.website)) return null;
  if (lh.totalBytes >= HEAVY_PAGE_BYTES) {
    return { kind: "heavy", megabytes: Math.round(lh.totalBytes / 1_000_000) };
  }
  if (lh.contrastFailures >= CONTRAST_FAILURE_FLOOR) return { kind: "contrast" };
  if (lh.unsizedImages >= UNSIZED_IMAGE_FLOOR) return { kind: "unsized" };
  return null;
}

const join = (...paragraphs: string[]): string => paragraphs.join("\n\n");

/**
 * An accepted enhanced message, sent as an email.
 *
 * The person read and chose that text, so it goes word for word. It was written
 * short enough for WhatsApp, which needs no sign-off. An email needs what every
 * first email has: the portfolio link once (the one proof an owner can check in
 * a click), the way out, and the signature. Copying Otaku-Yaki's on 13 Oct gave
 * a bare paragraph with none of them. Each is added only when the draft lacks
 * it: drafts written since 13 Oct link the portfolio and offer an AI assistant
 * themselves. The AI offer rides after it all as a P.S.
 */
export function draftEmail(place: Pick<EmailPlace, "name" | "category">, draft: string): Email {
  const text = draft.trim();
  const body = asEmail(text);
  return {
    subject: `A quick idea for ${place.name.trim()}`,
    body: /\bAI\b/.test(text) ? body : join(body, `P.S. ${toolsLine(place.category)}`),
  };
}

/**
 * What every email carries, added only where the text lacks it: the portfolio
 * link once, the way out, the signature.
 *
 * For accepted drafts, and for the ladder's follow-ups. Those are written for
 * both channels, and they went out by email bare until the verifier caught it
 * on 13 Oct: "every email" had meant every first email.
 */
export function asEmail(text: string): string {
  const body = text.trim();
  const parts = [body];
  // One link per email: a follow-up that links the demo needs no portfolio line.
  if (!/joshuasenining\.dev|https?:\/\//.test(body)) parts.push(PORTFOLIO);
  if (!body.includes(OPT_OUT)) parts.push(OPT_OUT);
  if (!body.includes("Joshua Senining")) parts.push(SIGNATURE);
  return join(...parts);
}

/**
 * The subject-line test (14 Oct).
 *
 * Forty-eight first messages and no reply could be the pitch, the market or
 * the sample size, and only data separates them. Every prospect is fixed in one
 * half by its id, so a copy, a reopen and its follow-ups carry the same
 * variant. The variant is recorded as the send's angle, and /review counts
 * replies per angle once outcomes are logged (five sends each before it
 * reports). The subjects are honest either way: each names the business and
 * nothing the email does not deliver.
 */
export type Variant = "a" | "b";

export function abVariant(id: string | undefined): Variant {
  if (!id) return "a";
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 2 === 0 ? "a" : "b";
}

/** "Bay Dental's", but "We Love Trees'": a name ending in s takes the apostrophe alone. */
export const possessive = (name: string) => (/s$/i.test(name.trim()) ? `${name.trim()}'` : `${name.trim()}'s`);

const SUBJECT: Record<"demo" | "no-website" | "site", Record<Variant, (name: string) => string>> = {
  demo: { a: (n) => `I made a website demo for ${n}`, b: (n) => `A website demo for ${n}` },
  "no-website": { a: (n) => `A simple website for ${n}?`, b: (n) => `Quick question for ${n}` },
  site: {
    a: (n) => `A quick idea for ${possessive(n)} website`,
    b: (n) => `Quick question about ${possessive(n)} website`,
  },
};

/**
 * PROOF without the link, for the email that links the demo instead. One link
 * per email (13 Oct), and the demo page itself links the portfolio, so the
 * portfolio is a click away either way.
 */
export const PROOF_NO_LINK =
  "I'm Joshua, a web and app developer in the Philippines. I've worked on websites " +
  "like ThredUp and ShopGoodwill and apps like Jollibee and JoyRide.";

export function firstEmail(place: EmailPlace): Email {
  const variant = abVariant(place.id);
  const tagged = (kind: string, email: Email): Email => ({ ...email, angle: `${kind}/subject-${variant}` });
  return place.website
    ? siteEmail(place, variant, tagged)
    : place.demoUrl
      ? tagged("demo", demoEmail(place, place.demoUrl, variant))
      : tagged("no-website", noWebsiteEmail(place, variant));
}

/** "Show, don't tell": the page is already made, so the email only asks them to look. */
function demoEmail(place: EmailPlace, url: string, variant: Variant): Email {
  const name = place.name.trim();
  const noun = nounFor(place.category);
  const where = place.city ? ` in ${place.city}` : "";
  return {
    subject: SUBJECT.demo[variant](name),
    body: join(
      `Hi ${name},`,
      `I couldn't find a website for ${name}, only your map listing. People often ` +
        `check Google before they call or visit, so some may pick the next ${noun}.`,
      `So I made you a free one-page demo, from the details on your map listing: ${url}`,
      // "See your details", not "find you": the demo is noindex, so nobody finds it
      // by searching (verifier, 14 Oct).
      `The spaces for your photos, services and prices are ready to fill. Someone looking ` +
        `for ${withArticle(noun)}${where} could then see your details and get in touch in a minute.`,
      toolsLine(place.category),
      PROOF_NO_LINK,
      // The demo was free and going live is not: say so before they say yes.
      `Want me to put it live for you, with your own photos and prices? Just reply "yes" ` +
        `and I'll tell you the cost first.`,
      OPT_OUT,
      SIGNATURE,
    ),
  };
}

function noWebsiteEmail(place: EmailPlace, variant: Variant): Email {
  const name = place.name.trim();
  const noun = nounFor(place.category);
  const where = place.city ? ` in ${place.city}` : "";
  const greeting = `Hi ${name},`;
  const tools = toolsLine(place.category);
  return {
      subject: SUBJECT["no-website"][variant](name),
      body: join(
        greeting,
        `I couldn't find a website for ${name}, only your map listing. People often ` +
          `check Google before they call or visit, so some may pick the next ${noun}.`,
        // Two sentences, not one of 37 words: the readability test holds every
        // sentence to 30 (13 Oct).
        `For example: one simple page with photos, your services and prices, and a big ` +
          `"Message us" button. Someone looking for ${withArticle(noun)}${where} could then decide in a ` +
          `minute, even late at night.`,
        tools,
        PROOF,
        `Would a free sample of that page be useful? Just reply "yes" and I'll send it.`,
        OPT_OUT,
        SIGNATURE,
      ),
    };
}

function siteEmail(
  place: EmailPlace,
  variant: Variant,
  tagged: (kind: string, email: Email) => Email,
): Email {
  const name = place.name.trim();
  const noun = nounFor(place.category);
  const greeting = `Hi ${name},`;
  const tools = toolsLine(place.category);
  const finding = findingOf(place);
  const subject = SUBJECT.site[variant](name);
  const offer =
    `Want me to send you a short list of what I'd fix first? It's free, and you can ` +
    `keep it either way.`;

  if (finding?.kind === "heavy") {
    return tagged("heavy", {
      subject,
      body: join(
        greeting,
        `I checked your website and noticed it's heavier than average: about ${finding.megabytes} MB ` +
          `for the homepage. Heavy pages are slow to load, and people who wait more than a ` +
          `few seconds often give up and pick another ${noun}.`,
        `For example: I'd make the same page lighter, so it opens faster, keeping your ` +
          `design as it is.`,
        tools,
        PROOF,
        offer,
        OPT_OUT,
        SIGNATURE,
      ),
    });
  }

  if (finding?.kind === "contrast") {
    return tagged("contrast", {
      subject,
      body: join(
        greeting,
        `I checked your website and noticed some of the text is hard to read — it blends ` +
          `into the colour behind it. When people can't read something easily, they tend to ` +
          `leave instead of getting in touch.`,
        `For example: changing the text or background colour so the two stand apart makes ` +
          `the whole page easier to read for everyone.`,
        tools,
        PROOF,
        offer,
        OPT_OUT,
        SIGNATURE,
      ),
    });
  }

  if (finding?.kind === "unsized") {
    return tagged("unsized", {
      subject,
      body: join(
        greeting,
        `I checked your website and noticed the page jumps around while it loads: some ` +
          `images don't hold their space, so the text below them moves. People lose their ` +
          `place, or tap the wrong thing.`,
        `For example: giving each image a fixed size keeps everything still while the page ` +
          `loads.`,
        tools,
        PROOF,
        offer,
        OPT_OUT,
        SIGNATURE,
      ),
    });
  }

  // A site nobody has measured, or one that measured fine: no claim about it at
  // all, only an offer — "I had a look" would be untrue, and the owner would know.
  return tagged("unmeasured", {
    subject,
    body: join(
      greeting,
      `You already have a website, so I'm not here to sell you a new one. I'd like to ` +
        `offer ${name} a free check of it instead.`,
      `For example: how many clicks it takes someone to book or message you, and whether ` +
        `your contact details are easy to find.`,
      tools,
      PROOF,
      // "Free" once per email: the offer above already says it.
      // Not "the check": to a restaurant that is the bill.
      `Would you like me to do that check? I'll send a short, plain-English list of ` +
        `what could help — yours to keep either way.`,
      OPT_OUT,
      SIGNATURE,
    ),
  });
}
