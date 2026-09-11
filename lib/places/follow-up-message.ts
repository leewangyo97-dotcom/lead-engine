import { LADDER_DAYS, MAX_STEP } from "../followups";

/**
 * The second and third messages to a prospect.
 *
 * Until now there were none. `logContact` built every message from
 * `firstMessage` or an accepted draft, so a prospect coming due on the ladder
 * would have received their opening message again, word for word, from someone
 * they had already ignored once. Eighteen of those come due on 13 September,
 * sixteen of them prospects, which is how this was found — by asking what would
 * actually be sent on Monday rather than whether the ladder fires.
 *
 * Three rules, from the outreach skill:
 *
 * - reference the first message in one line, so it is not a cold open twice;
 * - add something the first one did not say — never "just bumping this";
 * - make it easy to end, because a no now is worth more than silence for a week.
 *
 * Deterministic, and it claims nothing about their business. The first message
 * carries the observation and the risk of being wrong about it; a follow-up
 * repeating that doubles the exposure for nothing. What it adds instead is
 * smaller and safer: what the mockup would actually be, and an explicit way out.
 */
export interface FollowUpInput {
  name: string;
  /** 1 for the day-4 message, 2 for the day-11 one. */
  step: number;
  category?: string | null;
  /**
   * Whether they already have a site, which changes what there is to offer.
   *
   * Offering "one page showing your menu" to a restaurant that already has a
   * website with a menu on it reads as not having looked. The opener already
   * distinguishes the two cases; the follow-up has to as well.
   */
  hasWebsite?: boolean;
}

/**
 * What a one-pager would show, by trade. Nothing here is a claim about them.
 *
 * This map was written for the Cebu categories and had no entry for the ones the
 * Austin and Sydney searches produce, so ten of the sixteen follow-ups due on 14
 * September fell through to the default — which offered a WhatsApp button to a
 * roofing company in Texas. The trade decides what the page shows; the country
 * decides how someone gets in touch, and assuming WhatsApp does both was the
 * Philippines leaking into the other two funnels.
 */
const SHOWS: Record<string, string> = {
  restaurants: "your menu, where you are, and a button that opens WhatsApp",
  hotels: "your rooms, your rates, and an enquiry button",
  clinics: "your services and a way to ask for an appointment",
  veterinary: "your services and a way to ask for an appointment",
  dentists: "your services and a way to ask for an appointment",
  salons: "your treatments, your prices, and a booking button",
  schools: "your courses, your rates, and how to enrol",
  // Austin and Sydney. A trade is hired off a quote, not a booking slot, and
  // the areas covered is the question a roofer gets asked before any other.
  trades: "what you do, the areas you cover, and a form that asks for a quote",
  contractors: "what you do, the areas you cover, and a form that asks for a quote",
  professionalServices: "what you offer and a short form that starts an enquiry",
  medicalSpecialists: "your services and a way to ask for an appointment",
};

/** Deliberately says nothing about which app. The categories now span three countries. */
const DEFAULT_SHOWS = "what you offer, where you are, and an easy way to get in touch";

export function followUpMessage({
  name,
  step,
  category,
  hasWebsite = false,
}: FollowUpInput): string {
  if (step < 1 || step > MAX_STEP) {
    throw new Error(`no follow-up for step ${step}; the ladder runs 1 to ${MAX_STEP}`);
  }

  const shows = (category && SHOWS[category]) || DEFAULT_SHOWS;
  const business = name.trim();

  // What is on offer, said without judging what they already have. "Compare it
  // with what you have now" is an invitation; "your site is dated" is an opinion
  // this project has no way to support.
  const offer = hasWebsite
    ? `I'd mock up one page — ${shows} — so you can put it beside what you have now`
    : `one page showing ${shows}`;

  if (step === 1) {
    return (
      `Hi ${business} — following up on my message a few days ago. ` +
      `To be concrete about it: ${offer}. ` +
      `I'd build it first and you'd only decide after seeing it. ` +
      `Worth a look, or shall I leave it?`
    );
  }

  // The last one says it is the last one. A ladder with an end only works if the
  // person on the other side can tell it has ended.
  return (
    `Hi ${business} — last note from me, I won't keep messaging. ` +
    `The offer stands whenever it's useful: ${offer}, at no charge. ` +
    `If you'd rather not, no problem at all — good luck with the business.`
  );
}

/**
 * Which message a contact should carry, given where in the sequence it is.
 *
 * Pulled out of `logContact` so the rule can be tested without a database. The
 * rule is the whole point: step 0 is the opener — an accepted draft if one
 * exists, otherwise the generated one — and every step after it is a follow-up.
 * Returning `undefined` means "let `chooseChannel` generate the opener", which
 * is how the first message has always been built.
 */
export function messageFor(input: {
  step: number;
  draftBody?: string | null;
  name: string;
  category?: string | null;
  hasWebsite?: boolean;
}): string | undefined {
  if (input.step === 0) return input.draftBody ?? undefined;
  return followUpMessage({
    name: input.name,
    step: input.step,
    category: input.category,
    hasWebsite: input.hasWebsite,
  });
}

/** Days after the previous message that a given step is due. Mirrors the ladder. */
export function dueAfterDays(step: number): number {
  const days = LADDER_DAYS[step - 1];
  if (days == null) throw new Error(`no ladder rung for step ${step}`);
  return days;
}
