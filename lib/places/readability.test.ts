import { describe, expect, it } from "vitest";
import { asEmail, firstEmail, SIGNATURE } from "./email-message";
import { messageFor } from "./follow-up-message";
import { PLACE_CATEGORIES } from "./osm-categories";
import { readingGrade } from "./readability";
import { spamSamples } from "./spam-check";

/**
 * "Make it simple, short, and easy to understand, like explaining to a non-techy
 * person" (13 Oct), held to numbers.
 *
 * Grade 8 is the usual plain-language ceiling: readable by a 13-year-old, and by
 * an owner reading on a phone between customers. 35 words is where a sentence
 * stops being read in one go. Every email the app writes is checked, for every
 * kind of business, because the business kind changes the words.
 */
const MAX_GRADE = 8;
const MAX_SENTENCE_WORDS = 35;

const prose = (body: string) => body.replace(SIGNATURE, "").trim();

function sentences(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .flatMap((paragraph) => paragraph.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter(Boolean);
}

const wordCount = (sentence: string) => sentence.split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length;

/** Every email, for every business kind: first emails both ways, and both follow-ups. */
function everyEmail(): { label: string; body: string }[] {
  const samples = spamSamples().map(({ label, email }) => ({ label, body: email.body }));
  const byKind = PLACE_CATEGORIES.flatMap((category) => [
    {
      label: `no website, ${category}`,
      body: firstEmail({ name: "Bay Dental Studio", category, city: "Sydney", website: null, siteSignals: null }).body,
    },
    ...[1, 2].map((step) => ({
      label: `follow-up ${step}, ${category}`,
      body: asEmail(messageFor({ step, name: "Bay Dental Studio", category, hasWebsite: step === 1 }) ?? ""),
    })),
  ]);
  return [...samples, ...byKind];
}

describe("readability", () => {
  it(`reads at grade ${MAX_GRADE} or below, every email`, () => {
    const hard = everyEmail()
      .map(({ label, body }) => ({ label, grade: readingGrade(prose(body)) }))
      .filter(({ grade }) => grade > MAX_GRADE);
    expect(hard).toEqual([]);
  });

  it(`keeps every sentence to ${MAX_SENTENCE_WORDS} words`, () => {
    const long = everyEmail().flatMap(({ label, body }) =>
      sentences(prose(body))
        .filter((s) => wordCount(s) > MAX_SENTENCE_WORDS)
        .map((s) => `${label}: ${wordCount(s)} words — ${s.slice(0, 60)}`),
    );
    expect(long).toEqual([]);
  });

  it("scores hard text as hard, so the ceiling means something", () => {
    const plain = "We can make your page load fast. People like that. Want a free list?";
    const dense =
      "Comprehensive optimisation of heterogeneous infrastructural dependencies necessitates " +
      "considerable organisational deliberation regarding prospective implementation methodologies.";
    expect(readingGrade(plain)).toBeLessThan(MAX_GRADE);
    expect(readingGrade(dense)).toBeGreaterThan(MAX_GRADE * 2);
  });
});
