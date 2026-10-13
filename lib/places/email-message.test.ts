import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  asEmail,
  draftEmail,
  findingOf,
  firstEmail,
  nounFor,
  OPT_OUT,
  PROOF,
  SIGNATURE,
  taskFor,
  toolsLine,
  withArticle,
  type EmailPlace,
} from "./email-message";
import { signalKeys } from "./enhance";
import { messageFor } from "./follow-up-message";
import { PLACE_CATEGORIES } from "./osm-categories";
import { measuredMegabytes } from "./lighthouse-signals";
import { verifyMessage } from "./message-verify";

const SITE = "https://example-dental.com.au/";

/** A stored Lighthouse reading, in the shape `pnpm lh` writes. */
const measured = (over: Partial<{ totalBytes: number; contrastFailures: number; unsizedImages: number }>) => ({
  lighthouse: {
    url: SITE,
    measuredAt: "2026-10-01T00:00:00.000Z",
    totalBytes: 1_000_000,
    totalBytesLabel: "Total size was 977 KiB",
    contrastFailures: 0,
    unsizedImages: 0,
    ...over,
  },
});

const place = (over: Partial<EmailPlace> = {}): EmailPlace => ({
  name: "Bay Dental Studio",
  category: "dentists",
  city: "Sydney",
  website: SITE,
  siteSignals: null,
  ...over,
});

/** The same check `drafts:verify` and the copywriter's output are held to. */
const violations = (p: EmailPlace) =>
  verifyMessage(
    firstEmail(p).body,
    signalKeys({
      id: "p1",
      name: p.name,
      category: p.category,
      website: p.website,
      email: "hello@example.com",
      phoneE164: null,
      whatsappE164: null,
      siteSignals: p.siteSignals as Record<string, unknown> | null,
    }),
    // A stated size is held to the measurement too, as apply:enhance holds it.
    { megabytes: measuredMegabytes(p.website, p.siteSignals) },
  );

const VARIANTS: [string, EmailPlace][] = [
  ["no website on file", place({ website: null, siteSignals: null })],
  ["a heavy homepage", place({ siteSignals: measured({ totalBytes: 8_400_000 }) })],
  ["text that is hard to read", place({ siteSignals: measured({ contrastFailures: 21 }) })],
  ["images that make the page jump", place({ siteSignals: measured({ unsizedImages: 28 }) })],
  ["a site nobody has measured", place({ siteSignals: null })],
];

describe("firstEmail", () => {
  for (const [label, p] of VARIANTS) {
    it(`claims nothing it cannot back, for ${label}`, () => {
      expect(violations(p)).toEqual([]);
    });

    it(`carries the proof, the portfolio and the signature, for ${label}`, () => {
      const { body } = firstEmail(p);
      expect(body).toContain(PROOF);
      expect(body).toContain("joshuasenining.dev");
      expect(body.endsWith(SIGNATURE)).toBe(true);
      expect(body).toContain("For example");
    });

    it(`stays short and speaks to them by name, for ${label}`, () => {
      const { subject, body } = firstEmail(p);
      expect(subject.length).toBeLessThan(60);
      expect(body.startsWith(`Hi ${p.name},`)).toBe(true);
      // Seven short paragraphs plus the signature — a pitch, not a letter. Two
      // were added on 13 Oct, the AI offer and the way out, so the cap rose from
      // 160 words to 170.
      expect(body.split("\n\n").length).toBe(8);
      expect(body.split(/\s+/).length).toBeLessThan(170);
    });

    // Asked for on 13 Oct, after "will this go to spam?". A way out turns a
    // spam report into a reply. One link and one "free" read less like a mass
    // mailing than two of each.
    it(`gives a way out, one link and one "free", for ${label}`, () => {
      const { body } = firstEmail(p);
      expect(body).toContain(OPT_OUT);
      expect(body.split("joshuasenining.dev").length - 1).toBe(1);
      expect((body.match(/\bfree\b/gi) ?? []).length).toBeLessThanOrEqual(1);
      expect(body).not.toMatch(/no obligation|no cost/i);
    });
  }

  it("says what was looked for, not what is true, when no site is on file", () => {
    const { body } = firstEmail(place({ website: null }));
    expect(body).toMatch(/couldn't find a website/);
    expect(body).not.toMatch(/you don'?t have a (?:website|site)/i);
  });

  it("names a measured problem only when it was measured on their own site", () => {
    // A reading taken on another host is about somebody else's server.
    const elsewhere = { lighthouse: { ...measured({ totalBytes: 9_000_000 }).lighthouse, url: "https://other.example/" } };
    expect(findingOf({ website: SITE, siteSignals: elsewhere })).toBeNull();
    expect(firstEmail(place({ siteSignals: elsewhere })).body).not.toMatch(/MB|slow to load/);
  });

  it("leads with weight, the problem that loses people before they read anything", () => {
    expect(findingOf({ website: SITE, siteSignals: measured({ totalBytes: 8_400_000, contrastFailures: 30 }) })).toEqual({
      kind: "heavy",
      megabytes: 8,
    });
  });

  it("keeps the words of the trade out of an owner's inbox", () => {
    for (const [, p] of VARIANTS) {
      expect(firstEmail(p).body).not.toMatch(
        /\b(lighthouse|contrast ratio|page weight|kib|wcag|seo|cls|lcp|full stack|utc\+8|mockup)\b/i,
      );
    }
  });

  it("names only work PROFILE.md lists as shipped — never his own project as a client's", () => {
    // The first draft said "I built the website for Majar Funeral Service". PROFILE
    // lists Majar under own projects; the verifier caught it on 13 Oct.
    const shipped = readFileSync("memory/PROFILE.md", "utf8")
      .split("\n")
      .filter((line) => /^- \*\*(Android|Web)/.test(line))
      .join(" ");
    for (const name of ["ThredUp", "ShopGoodwill", "Jollibee", "JoyRide"]) {
      expect(PROOF).toContain(name);
      expect(shipped).toContain(name);
    }
    expect(PROOF).not.toMatch(/Majar|built the website for/);
  });

  it("never says Manila, and never uses the banned phrases", () => {
    for (const [, p] of VARIANTS) {
      expect(firstEmail(p).body).not.toMatch(/manila|passionate|reach out|leverage|I'd love the opportunity/i);
    }
  });

  it("sends an accepted draft word for word, with what an email needs added after it", () => {
    const text = "Hi Otaku-Yaki Restaurant — I couldn't find a website for you. Want me to?";
    const place = { name: "Otaku-Yaki Restaurant", category: "restaurants" };
    const { subject, body } = draftEmail(place, `${text}\n`);
    expect(body).toBe(
      [
        text,
        "You can see my work at joshuasenining.dev.",
        OPT_OUT,
        SIGNATURE,
        `P.S. ${toolsLine("restaurants")}`,
      ].join("\n\n"),
    );
    expect(subject).toBe("A quick idea for Otaku-Yaki Restaurant");
  });

  it("sends the ladder's follow-ups by email with the link, the way out and the signature", () => {
    // 13 Oct: only first emails had them, and the day-4 and day-11 emails went bare.
    for (const step of [1, 2]) {
      const ladder = messageFor({ step, name: "Bay Dental Studio", category: "dentists", hasWebsite: true })!;
      const body = asEmail(ladder);
      expect(body.startsWith(ladder)).toBe(true);
      expect(body).toContain(OPT_OUT);
      expect(body.endsWith(SIGNATURE)).toBe(true);
      expect(body.split("joshuasenining.dev").length - 1).toBe(1);
      expect(verifyMessage(body, ["website"])).toEqual([]);
    }
  });

  it("adds nothing a draft already has: the link, the way out, the signature, the AI offer", () => {
    // Drafts written since 13 Oct link the portfolio and offer the assistant
    // themselves; adding them again would put two links in the email.
    const text = `Hi there. My work is at joshuasenining.dev. ${toolsLine("cafes")}`;
    const { body } = draftEmail({ name: "X", category: "cafes" }, text);
    expect(body).toBe([text, OPT_OUT, SIGNATURE].join("\n\n"));
    expect(body.split("joshuasenining.dev").length - 1).toBe(1);
    const complete = [text, OPT_OUT, SIGNATURE].join("\n\n");
    expect(draftEmail({ name: "X", category: "cafes" }, complete).body).toBe(complete);
  });

  it("offers AI tools in every variant, worded for the kind of business", () => {
    for (const [, p] of VARIANTS) expect(firstEmail(p).body).toContain(toolsLine(p.category));
    expect(toolsLine("dentists")).toContain("books appointments");
    expect(toolsLine("restaurants")).toContain("takes table bookings");
    expect(taskFor("somethingNew")).toBe("books appointments");
  });

  it("offers the AI tools as a service, never as work already done", () => {
    // PROFILE lists AI automation under services, not shipped work.
    expect(toolsLine("clinics")).toMatch(/^I can also set up/);
    expect(toolsLine("clinics")).not.toMatch(/I've built|I built|clients|businesses like yours/i);
  });

  it("says 'an accountant', never 'a accountant', for every kind of business", () => {
    // The verifier caught "a accountant", "a auto repair shop", "a event service".
    for (const category of PLACE_CATEGORIES) {
      const { body } = firstEmail(place({ category, website: null }));
      expect(body).not.toMatch(/\ba [aeiou]/i);
    }
    expect(withArticle("accountant")).toBe("an accountant");
    expect(withArticle("dentist")).toBe("a dentist");
  });

  it("calls a business by its kind, and falls back to 'business'", () => {
    expect(nounFor("medicalSpecialists")).toBe("specialist");
    expect(nounFor("somethingNew")).toBe("business");
  });
});
