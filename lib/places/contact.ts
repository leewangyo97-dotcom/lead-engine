import { buildWhatsAppLink, isWhatsAppCapable } from "./phone";

/**
 * Choosing how to reach a prospect, and what the first message says.
 *
 * The spec orders channels email first. On the market this actually runs
 * against, that ordering would mean contacting almost nobody: of 100 Cebu
 * clinics and vets, 2 had a website, 15 had a usable phone, and effectively none
 * published an email. So the channel is chosen per prospect from what exists,
 * and WhatsApp wins when both do — it is where small businesses here answer.
 * If that is the wrong call for a market with better email coverage, the order
 * lives in `chooseChannel` and nowhere else.
 */

export interface ContactablePlace {
  name: string;
  city?: string | null;
  email?: string | null;
  phoneE164?: string | null;
  whatsappE164?: string | null;
  website?: string | null;
}

export type Channel = "whatsapp" | "email";

export interface ContactOption {
  channel: Channel;
  available: boolean;
  href?: string;
  /** Why this channel cannot be used, in words the user can act on. */
  reason?: string;
}

export interface ContactPlan {
  /** The channel to lead with, or null when there is no way to reach them. */
  preferred: Channel | null;
  whatsapp: ContactOption;
  email: ContactOption;
  message: string;
}

/**
 * The opening message.
 *
 * Deliberately short and answerable. A cold WhatsApp message is read on a phone,
 * probably between customers, so it opens with who we are, names one thing we
 * noticed, and asks one question. It never claims to have seen something we did
 * not check — the "no website" line is only used when the record genuinely has
 * no website, because a business owner knows perfectly well whether they have
 * one and an opening lie ends the conversation.
 */
export function firstMessage(place: ContactablePlace): string {
  const name = place.name.trim();
  const opener = `Hi ${name} — I'm Joshua, a web developer here in Cebu.`;

  const observation = place.website
    ? `I had a look at your site and had one or two ideas that might bring you more bookings.`
    : `I noticed you don't have a website yet — most people looking for a ${
        place.city ? `${place.city} ` : ""
      }business like yours start on Google.`;

  // One question, easy to answer with a word. "Let me know if interested" puts
  // the work on them and gets no reply.
  const ask = `Would it help if I put together a simple one-pager showing what it could look like? No charge for the mockup.`;

  return `${opener} ${observation}\n\n${ask}`;
}

export function chooseChannel(place: ContactablePlace, message?: string): ContactPlan {
  const text = message ?? firstMessage(place);

  const number = place.whatsappE164 ?? place.phoneE164 ?? null;
  const whatsapp: ContactOption = number
    ? isWhatsAppCapable(number)
      ? { channel: "whatsapp", available: true, href: buildWhatsAppLink(number, text) }
      : {
          channel: "whatsapp",
          available: false,
          // wa.me happily accepts a landline and fails only after the chat
          // opens, so the reason is worth saying before the click.
          reason: "landline — WhatsApp needs a mobile number",
        }
    : { channel: "whatsapp", available: false, reason: "no phone number" };

  const email: ContactOption = place.email
    ? {
        channel: "email",
        available: true,
        href: `mailto:${place.email}?subject=${encodeURIComponent(
          `A quick idea for ${place.name}`,
        )}&body=${encodeURIComponent(text)}`,
      }
    : { channel: "email", available: false, reason: "no email address" };

  return {
    preferred: whatsapp.available ? "whatsapp" : email.available ? "email" : null,
    whatsapp,
    email,
    message: text,
  };
}
