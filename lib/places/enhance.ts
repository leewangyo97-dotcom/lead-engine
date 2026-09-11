import { firstMessage, type ContactablePlace } from "./contact";
import {
  CONTRAST_FAILURE_FLOOR,
  HEAVY_PAGE_BYTES,
  measuredOn,
  storedLighthouse,
  UNSIZED_IMAGE_FLOOR,
} from "./lighthouse-signals";
import { isWhatsAppCapable } from "./phone";
import { ownDomainFromEmail } from "./own-domain";

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
  /** What Stage B actually observed, which outranks anything inferred. */
  siteSignals?: Record<string, unknown> | null;
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
    // "No website in the record" is a fact about the record. When the business
    // emails from a domain that looks like its own name, the record is probably
    // just missing one — Leura Wellness had no website tag in OpenStreetMap and
    // a live site at leurawellness.com.au, and a draft told them they had none.
    //
    // `no_website` is withheld in that case rather than merely annotated, which
    // makes the claim unshippable: `verifyMessage` requires that signal for any
    // "you don't have a website" phrasing, so the batch is rejected instead of
    // relying on whoever writes the message to read a warning.
    const owned = ownDomainFromEmail(place.name, place.email);
    if (owned) {
      signals.push({
        key: "email_domain",
        fact:
          `Their email is at ${owned}, which looks like their own domain — ` +
          "check it before saying anything about whether they have a website",
      });
    } else {
      signals.push({ key: "no_website", fact: "No website in the record" });
    }
  } else {
    signals.push({ key: "website", fact: `Website: ${place.website}` });

    // The measured value wins over the stored URL. OpenStreetMap holds plenty of
    // http:// links to sites that redirect to https, and a message telling an
    // owner their site is insecure when it is not is a checkable lie — the one
    // person who can disprove it is the person reading it.
    const measured = place.siteSignals as { noHttps?: boolean; noViewport?: boolean } | undefined;
    const insecure = measured ? measured.noHttps === true : place.website.startsWith("http://");
    if (insecure) {
      signals.push({ key: "no_https", fact: "Site is served over plain http, not https" });
    }
    if (measured?.noViewport === true) {
      signals.push({
        key: "no_viewport",
        fact: "Site has no viewport meta tag, so it does not adapt to phone screens",
      });
    }

    // Lighthouse, if `pnpm lh` has been run on this prospect. Only the page
    // weight becomes a signal: it is the one measurement here that survived two
    // runs byte for byte, and the one this project could not otherwise take —
    // the HTML enricher never fetches subresources, so a 10.5 MB homepage reads
    // to it as three clean booleans. The performance score is deliberately not
    // offered: it moved fifteen points on one site between two sessions.
    const lh = storedLighthouse(place.siteSignals);
    const current = lh && measuredOn(lh, place.website) ? lh : null;
    if (current && current.totalBytes >= HEAVY_PAGE_BYTES) {
      signals.push({
        key: "page_weight",
        fact:
          `Their homepage loads ${current.totalBytesLabel.replace(/^Total size was /, "")} ` +
          `(measured with Lighthouse on ${current.measuredAt.slice(0, 10)})`,
      });
    }

    // Text their own customers cannot read. Unlike page weight this was the
    // signal the drafted list actually produced — three of eleven cross the
    // floor, none crossed the weight one.
    //
    // The rendering is named because the number depends on it slightly: Alta
    // Roofing measures 40 at phone width and 39 on a desktop screen. An owner
    // who checks and sees 39 should find the message already told them which
    // screen it was talking about.
    if (current && current.contrastFailures >= CONTRAST_FAILURE_FLOOR) {
      signals.push({
        key: "contrast",
        fact:
          `${current.contrastFailures} elements on their homepage fail the contrast ` +
          `threshold at phone width (Lighthouse, ${current.measuredAt.slice(0, 10)})`,
      });
    }

    // No rendering named here, unlike contrast: this asks whether the markup
    // sets width and height, which is the same answer at every screen size.
    // Measured that way — 26/26/26 across three phone-width runs and 26 again on
    // desktop.
    //
    // The consequence is stated rather than a measured shift. Lighthouse's own
    // layout-shift metric is one of the volatile ones and is not stored; what is
    // stored is the cause, and the browser reserving no space for an image it
    // has no dimensions for is why the content under it moves.
    if (current && current.unsizedImages >= UNSIZED_IMAGE_FLOOR) {
      signals.push({
        key: "unsized_images",
        fact:
          `${current.unsizedImages} images on their homepage have no width or height ` +
          `set, so content below them moves as the page loads ` +
          `(Lighthouse, ${current.measuredAt.slice(0, 10)})`,
      });
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
    `Joshua is a web developer based in San Jose del Monte, Bulacan, in the`,
    `Philippines, writing to small businesses. Most of these go out over WhatsApp`,
    `and are read on a phone between customers.`,
    ``,
    `He is not local to any of these businesses unless they are in Bulacan. Never`,
    `imply he is nearby, and never claim he has visited or seen the place.`,
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
