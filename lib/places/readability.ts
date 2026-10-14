import { fleschKincaid } from "flesch-kincaid";
import { syllable } from "syllable";

/**
 * How hard a message is to read, as a US school grade (Flesch-Kincaid).
 *
 * Asked for on 13 Oct: the emails go to owners who are not technical, and "make
 * sure he will understand" needed a number that a test can hold to. Links are
 * dropped before counting, because a domain is one "word" that syllable rules
 * cannot read.
 */
export function readingGrade(text: string): number {
  const prose = text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\b[\w-]+\.(?:dev|com|au|ph|net|org)\b/g, "");
  const words = prose.match(/[A-Za-z][A-Za-z'’-]*/g) ?? [];
  const sentences = Math.max(1, (prose.match(/[.!?]+(?=\s|$)/g) ?? []).length);
  const syllables = words.reduce((sum, word) => sum + syllable(word), 0);
  return fleschKincaid({ sentence: sentences, word: words.length, syllable: syllables });
}
