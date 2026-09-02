import { firstMessage, type ContactablePlace } from "./contact";
import { isWhatsAppCapable } from "./phone";

/**
 * The "enhance" step: turning what is known about a prospect into a prompt, and
 * nothing else.
 *
 * No model is called from the server. Model work in this project runs inside
 * Claude Code, and the same shape is kept here — a prompt goes out, validated
 * JSON comes back through `pnpm apply:enhance`. A server-side model call would
 * be a second way of doing the one thing this project already has a way to do.
 */

export interface EnhanceablePlace extends ContactablePlace {
  id: string;
  category?: string | null;
  enrichmentStatus?: string | null;
}

export interface Signal {
  key: string;
  /** Stated so a person can check it against reality before it is sent. */
  fact: string;
}

/**
 * Facts about the prospect that are actually in the database.
 *
 * Only observable things. "Their site looks dated" is an opinion nobody
 * verified; "there is no website in the record" is checkable, and it is the
 * difference between a message that survives contact with the owner and one that
 * does not.
 */
export function buildSignals(place: EnhanceablePlace): Signal[] {
  const signals: Signal[] = [];

  if (place.category) signals.push({ key: "category", fact: `Category: ${place.category}` });
  if (place.city) signals.push({ key: "city", fact: `City: ${place.city}` });

  if (!place.website) {
    signals.push({ key: "no_website", fact: "No website in the record" });
  } else {
    signals.push({ key: "website", fact: `Website: ${place.website}` });
    if (place.website.startsWith("http://")) {
      signals.push({ key: "no_https", fact: "Site is served over plain http, not https" });
    }
  }

  if (place.email) signals.push({ key: "email", fact: "Has a published email address" });

  const number = place.whatsappE164 ?? place.phoneE164;
  if (place.whatsappE164) {
    signals.push({ key: "whatsapp_published", fact: "Publishes a WhatsApp number" });
  } else if (number && isWhatsAppCapable(number)) {
    signals.push({ key: "mobile", fact: "Has a mobile number, so WhatsApp is likely" });
  } else if (number) {
    signals.push({ key: "landline", fact: "Only a landline, so this will be email" });
  }

  if (place.enrichmentStatus === "no_contact_found") {
    signals.push({ key: "site_no_contact", fact: "Their site lists no contact details" });
  }

  return signals;
}

/** How long a first WhatsApp message may be. Longer than this is not read. */
export const MAX_MESSAGE_CHARS = 500;

/**
 * The prompt. Written to be pasted into Claude Code, which is where model work
 * in this project happens.
 */
export function buildEnhancePrompt(places: EnhanceablePlace[]): string {
  const blocks = places.map((place) => {
    const signals = buildSignals(place)
      .map((s) => `  - ${s.fact}`)
      .join("\n");

    return [
      `### ${place.name}`,
      `prospectId: ${place.id}`,
      `Known facts:`,
      signals || "  - nothing beyond the name",
      ``,
      `Current message:`,
      firstMessage(place)
        .split("\n")
        .map((l) => `  ${l}`)
        .join("\n"),
    ].join("\n");
  });

  return [
    `Rewrite the first outreach message for each business below.`,
    ``,
    `Joshua is a web developer in Cebu writing to small local businesses. Most of`,
    `these go out over WhatsApp and are read on a phone between customers.`,
    ``,
    `Rules:`,
    `- Use only the facts listed for that business. Do not invent a detail about`,
    `  their website, their reviews, their opening hours or their customers.`,
    `- If a business has no website, that is the opening. If it has one, do not`,
    `  imply it is bad — say what could be added.`,
    `- Under ${MAX_MESSAGE_CHARS} characters. One question, answerable in a word.`,
    `- No "I hope this finds you well", no bullet lists, no emoji.`,
    `- Write as a person messaging another person, not as a company.`,
    ``,
    `Return JSON only:`,
    `{"enhanced":[{"prospectId":"...","message":"...","angle":"...","usedSignals":["no_website"]}]}`,
    ``,
    `angle is two or three words naming the approach, for the learning loop.`,
    `usedSignals lists the keys of the facts you actually leaned on.`,
    ``,
    ...blocks,
  ].join("\n");
}

/** Signal keys, for validating that a returned message used real facts. */
export function signalKeys(place: EnhanceablePlace): string[] {
  return buildSignals(place).map((s) => s.key);
}
