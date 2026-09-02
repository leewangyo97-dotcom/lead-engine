// The "max" metadata, not the default. The default bundle omits number-type
// data, so getType() returns undefined for every Philippine number and a Cebu
// landline reads as WhatsApp-capable — a link that fails only after the user
// clicks it. The extra metadata is worth its size for that alone.
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";

/**
 * Turns whatever OpenStreetMap holds into E.164, or nothing.
 *
 * Real values from one Cebu search: "+63322382289",
 * "+63 32 344-1238;+63 917 555 0000", "(032) 123 4567". A column called
 * phoneE164 holding any of those verbatim is a lie the WhatsApp link would
 * then act on — wa.me takes digits only, and a malformed number opens a chat
 * with the wrong person or nobody.
 *
 * Returns the first number that validates. Invalid input yields null rather
 * than a best guess: offering a broken WhatsApp link is worse than offering
 * none, because the user finds out only after the chat opens.
 */
export function toE164(raw: string | null | undefined, country?: string | null): string | null {
  if (!raw) return null;

  // OSM separates multiple numbers with ";" and sometimes "," or "/".
  for (const candidate of raw.split(/[;,/]/)) {
    const trimmed = candidate.trim();
    if (!trimmed) continue;

    const parsed = parsePhoneNumberFromString(
      trimmed,
      (country?.toUpperCase() as CountryCode) || undefined,
    );
    if (parsed?.isValid()) return parsed.number;
  }
  return null;
}

/**
 * Whether a number can plausibly receive WhatsApp.
 *
 * WhatsApp runs on mobile numbers. A landline is accepted by wa.me and simply
 * fails silently once opened, so the UI needs to distinguish them — the spec
 * calls for the button to be disabled with a reason rather than hopeful.
 */
export function isWhatsAppCapable(e164: string | null | undefined): boolean {
  if (!e164) return false;
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed?.isValid()) return false;

  const type = parsed.getType();
  // Undefined still means the library cannot tell, which happens for countries
  // with thin metadata; treating that as "not mobile" would discard usable
  // leads, so unknown stays optimistic while a known landline does not.
  return type === undefined || type === "MOBILE" || type === "FIXED_LINE_OR_MOBILE";
}

/** wa.me wants bare digits: no plus, no spaces, no punctuation. */
export function buildWhatsAppLink(phoneE164: string, message: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
