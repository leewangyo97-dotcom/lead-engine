import { asEmail, draftEmail, firstEmail, type Email, type EmailPlace } from "./email-message";
import { messageFor } from "./follow-up-message";

/**
 * The pieces of `pnpm spam:check` that need no Docker: which emails to score,
 * how to wrap one as a real message, and how to read SpamAssassin's verdict.
 *
 * Asked for on 13 Oct ("high chance of not going to spam"). SpamAssassin judges
 * the words and the headers, not the sender's reputation, which is most of what
 * Gmail weighs. A clean score here is necessary, not sufficient.
 */

/** Every kind of email the app writes, on a fixed example business. */
export function spamSamples(): { label: string; email: Email }[] {
  const site = "https://example-dental.com.au/";
  const reading = (over: object) => ({
    lighthouse: {
      url: site,
      measuredAt: "2026-10-01T00:00:00.000Z",
      totalBytes: 1_000_000,
      totalBytesLabel: "Total size was 977 KiB",
      contrastFailures: 0,
      unsizedImages: 0,
      ...over,
    },
  });
  const place: EmailPlace = {
    name: "Bay Dental Studio",
    category: "dentists",
    city: "Sydney",
    website: site,
    siteSignals: null,
  };
  const followUp = (step: number): Email => ({
    subject: `Re: A quick idea for ${place.name}'s website`,
    body: asEmail(
      messageFor({ step, name: place.name, category: place.category, hasWebsite: true }) ?? "",
    ),
  });
  return [
    { label: "no website", email: firstEmail({ ...place, website: null }) },
    { label: "heavy page", email: firstEmail({ ...place, siteSignals: reading({ totalBytes: 8_400_000 }) }) },
    { label: "hard to read", email: firstEmail({ ...place, siteSignals: reading({ contrastFailures: 21 }) }) },
    { label: "page jumps", email: firstEmail({ ...place, siteSignals: reading({ unsizedImages: 28 }) }) },
    { label: "not measured", email: firstEmail(place) },
    {
      label: "enhanced draft",
      email: draftEmail(
        place,
        "Hi Bay Dental Studio — I'm Joshua, a web and app developer in the Philippines. " +
          "Your homepage is about 8 MB, so it is slow to open. I'd make it lighter, keeping " +
          "your design as it is. My work is at joshuasenining.dev. Want a list of what I'd fix first?",
      ),
    },
    { label: "follow-up 1", email: followUp(1) },
    { label: "follow-up 2", email: followUp(2) },
  ];
}

/** A subject line as a header: RFC 2047 when it is not plain ASCII. */
function headerText(text: string): string {
  return /^[\x20-\x7e]*$/.test(text)
    ? text
    : `=?UTF-8?B?${Buffer.from(text, "utf8").toString("base64")}?=`;
}

/**
 * The email as Gmail would send it, in plain text, from a gmail.com address,
 * since that is where these go out from. Fixed addresses and ids, so the score
 * depends on the words alone.
 */
export function toEml(email: Email, date = new Date("2026-10-13T02:00:00Z")): string {
  const when = date.toUTCString().replace("GMT", "+0000");
  return [
    "From: Joshua Senining <sender@gmail.com>",
    "To: owner@example-dental.com.au",
    `Subject: ${headerText(email.subject)}`,
    `Date: ${when}`,
    "Message-ID: <CAJ3x0ampleId0001@mail.gmail.com>",
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    email.body,
    "",
  ].join("\r\n");
}

/**
 * Rules that fire because this is a test message, not because of anything in
 * the email. They are reported, and left out of the score the check holds to.
 *
 * FORGED_GMAIL_RCVD wants the X-Gm-Message-State and X-Google-Smtp-Source
 * headers that Gmail's own servers add to a real send. A message written here
 * has no honest way to carry them, and faking them would test the fakes.
 */
export const TEST_ARTIFACTS: Record<string, string> = {
  FORGED_GMAIL_RCVD: "a real Gmail send carries the Google headers this test message cannot",
};

/** The score the words earn: everything except the test artifacts. */
export function contentScore(verdict: SpamVerdict): number {
  const artifacts = verdict.rules
    .filter((r) => r.name in TEST_ARTIFACTS)
    .reduce((sum, r) => sum + r.points, 0);
  return Math.round((verdict.score - artifacts) * 10) / 10;
}

export interface SpamVerdict {
  score: number;
  required: number;
  rules: { name: string; points: number; description: string }[];
}

/** Reads `spamassassin -t` output: the score line, then each rule it hit. */
export function parseSpamReport(output: string): SpamVerdict | null {
  const status = output.match(/Content analysis details:\s*\((-?[\d.]+) points?, ([\d.]+) required\)/);
  if (!status) return null;

  // The first table only, from under its dashed rule to the blank line that
  // ends it. A message over the line is wrapped in a report with the original
  // attached, and the table is printed twice. Reading on counted every rule
  // twice: 4.1 for a 5.1 message.
  const start = output.indexOf(status[0]);
  const dashes = output.indexOf("\n----", start);
  const from = dashes === -1 ? start : output.indexOf("\n", dashes + 1);
  const end = output.indexOf("\n\n", from);
  const table = output.slice(from, end === -1 ? undefined : end);

  const rules = [...table.matchAll(/^\s*(-?\d+(?:\.\d+)?)\s+([A-Z][A-Z0-9_]+)\s+(.+)$/gm)].map((m) => ({
    points: Number(m[1]),
    name: m[2],
    description: m[3].trim(),
  }));
  return { score: Number(status[1]), required: Number(status[2]), rules };
}
