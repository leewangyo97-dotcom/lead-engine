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
  name: string;
  category: string;
  city: string | null;
  website: string | null;
  siteSignals: unknown;
}

export interface Email {
  subject: string;
  body: string;
}

export const SIGNATURE = [
  "—",
  "Joshua Senining",
  "Web and app developer · the Philippines",
  "joshuasenining.dev · WhatsApp +63 915 858 7388",
].join("\n");

/**
 * Who he is and what can be checked — every claim in PROFILE.md.
 *
 * The signature above is the outreach one in plain words: an owner does not know
 * what "Full Stack" or "UTC+8" means, and neither changes their answer.
 */
export const PROOF =
  "I'm Joshua, a web and app developer in the Philippines. I've worked on websites " +
  "like ThredUp and ShopGoodwill and apps like Jollibee and JoyRide — you can see " +
  "my work at joshuasenining.dev.";

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
    return { kind: "heavy", megabytes: Math.round(lh.totalBytes / 1_048_576) };
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
 * short enough for WhatsApp, which needs no sign-off; an email does, and the
 * signature carries the portfolio link — the one piece of proof an owner can
 * check in a click. Copying Otaku-Yaki's on 13 Oct gave a bare paragraph with
 * neither. The AI offer every first email carries rides after it as a P.S., so
 * the accepted text itself is not touched.
 */
export function draftEmail(place: Pick<EmailPlace, "name" | "category">, draft: string): Email {
  const text = draft.trim();
  const signed = text.includes("joshuasenining.dev") ? text : join(text, SIGNATURE);
  return {
    subject: `A quick idea for ${place.name.trim()}`,
    body: text.includes("AI tools") ? signed : join(signed, `P.S. ${toolsLine(place.category)}`),
  };
}

export function firstEmail(place: EmailPlace): Email {
  const name = place.name.trim();
  const noun = nounFor(place.category);
  const where = place.city ? ` in ${place.city}` : "";
  const greeting = `Hi ${name},`;
  const tools = toolsLine(place.category);

  if (!place.website) {
    return {
      subject: `A simple website for ${name}?`,
      body: join(
        greeting,
        `I couldn't find a website for ${name}, only your map listing. People often ` +
          `check Google before they call or visit, so some may pick the next ${noun}.`,
        `For example: one simple page with photos, your services and prices, and a big ` +
          `"Message us" button, so someone looking for a ${noun}${where} can decide in a ` +
          `minute, even late at night.`,
        tools,
        PROOF,
        `Would a free sample of that page be useful? Just reply "yes" and I'll send it — ` +
          `no cost, no obligation.`,
        SIGNATURE,
      ),
    };
  }

  const finding = findingOf(place);
  const subject = `A quick idea for ${name}'s website`;
  const offer =
    `Want me to send you a short list of what I'd fix first? It's free, and you can ` +
    `keep it either way.`;

  if (finding?.kind === "heavy") {
    return {
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
        SIGNATURE,
      ),
    };
  }

  if (finding?.kind === "contrast") {
    return {
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
        SIGNATURE,
      ),
    };
  }

  if (finding?.kind === "unsized") {
    return {
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
        SIGNATURE,
      ),
    };
  }

  // A site nobody has measured, or one that measured fine: no claim about it at
  // all, only an offer — "I had a look" would be untrue, and the owner would know.
  return {
    subject,
    body: join(
      greeting,
      `You already have a website, so I'm not here to sell you a new one. I'd like to ` +
        `offer ${name} a free check of it instead.`,
      `For example: how many clicks it takes someone to book or message you, and whether ` +
        `your contact details are easy to find.`,
      tools,
      PROOF,
      `Would you like the free check? I'll send a short, plain-English list of what ` +
        `could help — yours to keep either way.`,
      SIGNATURE,
    ),
  };
}
