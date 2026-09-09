/**
 * Splits a draft body around the verifier's quoted text so it can be marked.
 *
 * The quotes come from the model, so they can contain anything — brackets,
 * percent signs, dots — and they go straight into a regular expression. An
 * unescaped quote either throws or matches the wrong span, and the consequence
 * on screen is a violation highlighted over innocent text while the real
 * sentence reads as fine.
 */
export interface Part {
  text: string;
  flagged: boolean;
}

/** Every character that means something else inside a character class or pattern. */
const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;

export function highlight(body: string, quotes: string[]): Part[] {
  if (!quotes.length) return [{ text: body, flagged: false }];

  // A quote the verifier reported but the body does not contain would match
  // nothing, and an empty one would match everywhere.
  const found = quotes.filter((q) => q.length > 0 && body.includes(q));
  if (!found.length) return [{ text: body, flagged: false }];

  const pattern = found
    .map((q) => q.replace(REGEX_SPECIAL, String.raw`\$&`))
    // Longest first: with two overlapping quotes the shorter one would otherwise
    // win and leave the rest of the longer one unmarked.
    .sort((a, b) => b.length - a.length)
    .join("|");

  return body
    .split(new RegExp(`(${pattern})`, "g"))
    .filter(Boolean)
    .map((text) => ({ text, flagged: found.includes(text) }));
}
