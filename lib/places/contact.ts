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
  /**
   * How much the WhatsApp number is worth trusting.
   *
   * "confirmed" means the business published a wa.me link or a contact:whatsapp
   * tag — they are telling us this number takes WhatsApp. "likely" means only
   * that the number classifies as mobile, which is a good guess in the
   * Philippines and a coin toss in the United States, where mobile and landline
   * share ranges and libphonenumber cannot separate them.
   *
   * There is no free, reliable way to ask WhatsApp whether a number is
   * registered: wa.me answers the same for any number, the Business API does not
   * expose it on a personal account, and the third-party checkers are paid and
   * against WhatsApp's terms. So this says what is actually known instead of
   * pretending to know more.
   */
  confidence?: "confirmed" | "likely";
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
 * noticed, and asks one question.
 *
 * It says what was looked for, not what is true. "You don't have a website" is a
 * claim about their business; "I couldn't find one" is a fact about the search,
 * and only the second is something this project can stand behind. The record's
 * idea of who has a website comes from OpenStreetMap, which is often simply
 * missing one — a draft went out for review telling Leura Wellness they had no
 * website while leurawellness.com.au was serving a 349KB site.
 *
 * The difference matters more here than it would elsewhere, because the reader
 * is the one person on earth who knows the answer. Getting it wrong in the first
 * line ends the conversation; asking instead costs nothing and invites a reply
 * even when the guess is wrong.
 */
export function firstMessage(place: ContactablePlace): string {
  const name = place.name.trim();
  // PROFILE.md places Joshua in San Jose del Monte, Bulacan. The opener used to
  // say "here in Cebu" because the first searches were Cebu searches, which is a
  // false claim of local presence to every business it was sent to — and the
  // searches now run in Austin and Sydney as well.
  const opener = `Hi ${name} — I'm Joshua, a web developer here in the Philippines.`;

  const observation = place.website
    // Not "I had a look at your site": a prospect whose site has never been
    // fetched would make that a lie, and the owner is the one person who could
    // catch it by asking what I saw.
    ? `You already have a site — I had one or two ideas that might bring you more bookings through it.`
    : `I couldn't find a website for you — most people looking for a ${
        place.city ? `${place.city} ` : ""
      }business like yours start on Google. If you have one and I missed it, tell me and I'll shut up.`;

  // One question, easy to answer with a word. "Let me know if interested" puts
  // the work on them and gets no reply.
  const ask = `Would it help if I put together a simple one-pager showing what it could look like? No charge for the mockup.`;

  return `${opener} ${observation}\n\n${ask}`;
}

export function chooseChannel(place: ContactablePlace, message?: string): ContactPlan {
  const text = message ?? firstMessage(place);

  // A number the business published for WhatsApp beats our classifier.
  //
  // Dresden Vision in Sydney advertises +61 2 5300 3003, which libphonenumber
  // calls a fixed line — and WhatsApp Business accepts landlines, so the button
  // was disabled on a number its owner asks to be contacted on. Their claim is
  // evidence; a number range is only an inference.
  const whatsapp: ContactOption = place.whatsappE164
    ? {
        channel: "whatsapp",
        available: true,
        href: buildWhatsAppLink(place.whatsappE164, text),
        confidence: "confirmed",
      }
    : place.phoneE164
      ? isWhatsAppCapable(place.phoneE164)
        ? {
            channel: "whatsapp",
            available: true,
            href: buildWhatsAppLink(place.phoneE164, text),
            confidence: "likely",
          }
        : {
            channel: "whatsapp",
            available: false,
            // wa.me happily accepts a landline and fails only after the chat
            // opens, so the reason is worth saying before the click.
            reason: "landline, and they publish no WhatsApp number",
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
