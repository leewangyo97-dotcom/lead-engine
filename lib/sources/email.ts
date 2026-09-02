/**
 * Cleaning an address scraped out of prose.
 *
 * A "Who is hiring" post writes `email us at jobs@example.com.` and the trailing
 * full stop belongs to the sentence, not the address. Gmail answers a recipient
 * like that with INVALID_ARGUMENT and creates nothing, which is how this was
 * found: a verified draft that could not be delivered anywhere.
 */
export function cleanEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const trimmed = raw
    .trim()
    // Sentence punctuation and wrapping characters, never part of an address.
    .replace(/^[<("']+/, "")
    .replace(/[>)"'.,;:!?]+$/, "")
    .toLowerCase();

  // A last check rather than a second regex: the address has to end in letters.
  if (!/^[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}$/.test(trimmed)) return null;
  return trimmed;
}
