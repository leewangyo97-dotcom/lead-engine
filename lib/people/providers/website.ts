import * as cheerio from "cheerio";
import { findPhoneNumbersInText, type CountryCode } from "libphonenumber-js/max";
import { toE164 } from "../../places/phone";
import { isPersonalEmail, isRoleAddress, isValidSyntax } from "../email-pattern";
import { isDecisionMaker } from "../seniority";
import { emptyFindings, type CompanyRef, type Findings, type PeopleProvider, type PersonFinding } from "./types";

/**
 * The company's own website: home page, then up to four of its about, team,
 * leadership and contact pages, found by following its own links rather than
 * guessing paths (fewer requests, no 404 storm).
 *
 * People come from two places. Schema.org Person data, when the site has it,
 * is the cleanest. Otherwise team cards: a name with a decision-maker's title
 * beside it, and the mailto, tel and LinkedIn links in the same card. Only
 * business contacts are kept: an address on the company's own domain, never a
 * free mailbox, and only numbers the company published. LinkedIn URLs are
 * stored as links and never fetched.
 */
const MAX_PAGES = 4;
const KEY_PAGE = /(team|leadership|people|management|staff|founders?|board|who-?we-?are|our-?story|about|contact)/i;
const PREFERENCE = [/team|leadership|people|management|staff|founder|board/i, /about|who-?we-?are|our-?story/i, /contact/i];

const NOT_A_NAME = /\b(team|about|contact|services?|our|meet|leadership|board|management|clinic|dental|medical|welcome|home|news|blog|careers?|privacy|terms|ltd|inc|llc|pty|group|company|limited|corporation|solutions|studio|center|centre|hours|location|book|appointment)\b/i;
const NAME_WORD = /^(?:[A-Z][a-zA-Z'’-]+\.?|de|del|dela|van|von|der|da|di|bin|binti|la|le)$/;

/**
 * Headings that pass for names: two capitalised words beside a sentence that
 * says "owner". Alta Roofing's "Quality Materials" and "The Alta Difference"
 * were saved as founders on 17 Oct.
 */
const MARKETING =
  /^the\s|\b(quality|materials|difference|experience|local|personal|choose|why|approach|mission|values|story|process|guarantee|promise|family|owned|operated|free|quote|estimate|satisfaction|reviews?|testimonials?|gallery|projects?|portfolio|expert|professional|trusted|certified|licensed|insured)\b/i;

export function looksLikeName(text: string): boolean {
  const t = text.trim();
  if (t.length < 4 || t.length > 40 || NOT_A_NAME.test(t) || MARKETING.test(t)) return false;
  const words = t.split(/\s+/);
  return words.length >= 2 && words.length <= 4 && words.every((w) => NAME_WORD.test(w)) && /^[A-Z]/.test(words[words.length - 1]);
}

const clean = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * Parsed with a space between every pair of tags. cheerio's .text() fuses
 * adjacent elements, so a title read as "Chief of StaffPortland, USA" on
 * buffer.com, and "6776EMAIL" hid a phone number (14 Oct).
 */
const load = (html: string) => cheerio.load(html.replace(/></g, "> <"));

// The role words a sentence-for-a-title is reduced to, in the order bands rank them.
const ROLE_WORD =
  /\b(co-?founder|founder|co-?owner|owner|proprietor|principal|managing partner|ceo|president|managing director|general manager|director)\b/i;

/**
 * "CEO", from ", CEO • Apr 29": a byline's punctuation and date dropped.
 * A licence number goes too ("CO-OWNER - DEN 0002084625"), and a sentence
 * standing in for a title ("Hi there! I'm the founder of Smile Me Dental.")
 * becomes the role it names, or nothing.
 */
export function cleanTitle(raw: string): string {
  const title = clean(raw)
    .replace(/^[\s,;:–—-]+/, "")
    .split(/\s[•·|]\s/)[0]
    .replace(/\s*[-–—,]?\s*\b[A-Z]{0,5}\s*\d{5,}\b.*$/, "")
    .trim();
  const sentence = title.length > 60 || /[!?]|\.\s|\b(i'm|i am|i’m|we are|you)\b/i.test(title);
  if (!sentence) return title;
  const role = title.match(ROLE_WORD)?.[1];
  return role ? role.charAt(0).toUpperCase() + role.slice(1).toLowerCase() : "";
}

function sameSite(href: string, domain: string): boolean {
  try {
    const host = new URL(href).hostname.toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  } catch {
    return false;
  }
}

/** The site's own about/team/contact pages, best first, at most MAX_PAGES. */
export function keyPages(html: string, base: string, domain: string): string[] {
  const $ = load(html);
  const found = new Map<string, number>();
  $("a[href]").each((_, a) => {
    let href: string;
    try {
      href = new URL($(a).attr("href")!, base).toString().split("#")[0];
    } catch {
      return;
    }
    if (!sameSite(href, domain) || href === base) return;
    const label = `${new URL(href).pathname} ${clean($(a).text())}`;
    if (!KEY_PAGE.test(label)) return;
    const rank = PREFERENCE.findIndex((p) => p.test(label));
    if (!found.has(href)) found.set(href, rank === -1 ? PREFERENCE.length : rank);
  });
  return [...found.entries()]
    .sort((a, b) => a[1] - b[1])
    .slice(0, MAX_PAGES)
    .map(([href]) => href);
}

function businessEmail(raw: string | undefined, domain: string): string | null {
  const email = raw?.replace(/^mailto:/i, "").split("?")[0].trim().toLowerCase();
  if (!email || !isValidSyntax(email) || isPersonalEmail(email)) return null;
  return sameSite(`https://${email.split("@")[1]}`, domain) ? email : null;
}

/** People on one page, from schema.org data first, then from team cards. */
export function extractPeople(html: string, pageUrl: string, company: CompanyRef): PersonFinding[] {
  const domain = company.domain ?? "";
  const $ = load(html);
  const people = new Map<string, PersonFinding>();

  const add = (p: { name: string; title?: string; email?: string | null; phone?: string | null; linkedin?: string | null }) => {
    const name = clean(p.name);
    const title = p.title ? cleanTitle(p.title) : "";
    if (!looksLikeName(name) || !title || !isDecisionMaker(title) || people.has(name.toLowerCase())) return;
    const finding: PersonFinding = { name, title, facts: [] };
    const fact = (field: string, value: string) =>
      finding.facts.push({ field, value, sourceUrl: pageUrl, sourceType: "website" });
    fact("name", name);
    fact("title", finding.title!);
    if (p.email) {
      finding.email = p.email;
      finding.emailStatus = "verified";
      fact("email", p.email);
    }
    if (p.phone) {
      finding.phone = p.phone;
      fact("phone", p.phone);
    }
    if (p.linkedin) {
      finding.linkedinUrl = p.linkedin;
      fact("linkedinUrl", p.linkedin);
    }
    people.set(name.toLowerCase(), finding);
  };

  // Schema.org Person, anywhere in any JSON-LD block, including an
  // organisation's founder, employee and member lists.
  const walk = (node: unknown, key: string | null): void => {
    if (Array.isArray(node)) return node.forEach((n) => walk(n, key));
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    const types = ([] as unknown[]).concat(obj["@type"] ?? []);
    if (types.includes("Person") && typeof obj.name === "string") {
      const sameAs = ([] as unknown[]).concat(obj.sameAs ?? []).filter((s): s is string => typeof s === "string");
      add({
        name: obj.name,
        title: typeof obj.jobTitle === "string" ? obj.jobTitle : key?.startsWith("founder") ? "Founder" : undefined,
        email: businessEmail(typeof obj.email === "string" ? obj.email : undefined, domain),
        phone: typeof obj.telephone === "string" ? toE164(obj.telephone, company.countryCode) : null,
        linkedin: sameAs.find((s) => /linkedin\.com\/in\//i.test(s)) ?? null,
      });
    }
    for (const [k, v] of Object.entries(obj)) if (k !== "@type") walk(v, k);
  };
  $('script[type="application/ld+json"]').each((_, s) => {
    try {
      walk(JSON.parse($(s).text()), null);
    } catch {
      // Malformed JSON-LD is common, and not ours to fix.
    }
  });

  // Team cards: a name, its title in the same small block, and that block's links.
  $("h2,h3,h4,h5,h6,strong,b,figcaption,[itemprop=name],[class*=name]").each((_, el) => {
    const text = clean($(el).text());
    let name = text;
    let title: string | undefined;

    const inline = text.match(/^(.{4,40}?)\s*(?:,|\s[-–—|]\s)\s*(.{2,80})$/);
    if (inline && looksLikeName(inline[1]) && isDecisionMaker(inline[2])) {
      [name, title] = [inline[1], inline[2]];
    } else if (looksLikeName(text)) {
      // Each neighbour's first line before its whole text: a card's title
      // element often carries the location after it.
      const near = [$(el).next(), $(el).next().next(), $(el).parent().next()].flatMap((n) => {
        const first = n
          .find("*")
          .addBack()
          .contents()
          .toArray()
          .find((c) => c.type === "text" && c.data.trim());
        return [first && "data" in first ? clean(first.data) : "", clean(n.text())];
      });
      // A neighbour that opens with a name is the next person's card, not this
      // one's title: "Raj Patel, Practice Director" became Tom Reyes's title.
      const anotherPerson = (t: string) => {
        const lead = t.match(/^(.{4,40}?)\s*(?:,|\s[-–—|]\s)/);
        return !!lead && looksLikeName(lead[1]);
      };
      title = near
        .filter((t) => t && t.length <= 80 && !anotherPerson(t))
        .find((t) => isDecisionMaker(cleanTitle(t)));
    } else {
      return;
    }
    if (!title) return;

    // The card is the smallest block around the name that holds its links, and
    // never one that also holds another person's heading. Climbing by text
    // length alone reached the page body on a short card and gave Raj Patel
    // Jane Doe's address (caught by the fixture test, 14 Oct).
    let card = $(el).parent();
    for (let depth = 0; depth < 3 && clean(card.text()).length < 60; depth++) {
      const up = card.parent();
      if (!up.length || up.find("h2,h3,h4,h5,h6").length > 1 || clean(up.text()).length > 800) break;
      card = up;
    }
    const mailto = card.find('a[href^="mailto:"]').first().attr("href");
    const tel = card.find('a[href^="tel:"]').first().attr("href");
    const linkedin = card.find('a[href*="linkedin.com/in/"]').first().attr("href");
    add({
      name,
      title,
      email: businessEmail(mailto, domain),
      phone: tel ? toE164(tel.replace(/^tel:/i, ""), company.countryCode) : null,
      linkedin: linkedin ?? null,
    });
  });

  return [...people.values()];
}

/** What the pages say about the company: desk addresses, numbers, need signals. */
export function extractCompany(pages: { url: string; html: string }[], company: CompanyRef, now: Date) {
  const domain = company.domain ?? "";
  const findings = emptyFindings().company;
  const seen = new Set<string>();
  const home = pages[0]?.html ?? "";
  const allText = pages.map((p) => load(p.html)("body").text()).join(" ");

  for (const { url, html } of pages) {
    const $ = load(html);
    $('a[href^="mailto:"]').each((_, a) => {
      const email = businessEmail($(a).attr("href"), domain);
      if (email && isRoleAddress(email) && !seen.has(email)) {
        seen.add(email);
        findings.facts.push({ field: "email", value: email, sourceUrl: url, sourceType: "website" });
      }
    });
    $('a[href^="tel:"]').each((_, a) => {
      const phone = toE164($(a).attr("href")!.replace(/^tel:/i, ""), company.countryCode);
      if (phone && !seen.has(phone)) {
        seen.add(phone);
        findings.facts.push({ field: "phone", value: phone, sourceUrl: url, sourceType: "website" });
      }
    });

    // Plain text too: JT Dental's contact page prints "PHONE:" and "EMAIL:"
    // with no links at all (14 Oct). Addresses on their own domain only, and
    // numbers only from contact pages, where a number is the business's.
    // Visible text only. SVG path data on JT Dental's page ("13.4259") read
    // as Australian 13-numbers, 21 of them, before scripts, styles and SVG
    // were dropped and short numbers refused.
    $("script,style,svg,noscript,template").remove();
    const text = $("body").text();
    for (const match of text.matchAll(/[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi)) {
      const email = businessEmail(match[0], domain);
      if (email && !seen.has(email)) {
        seen.add(email);
        findings.facts.push({ field: "email", value: email, sourceUrl: url, sourceType: "website" });
      }
    }
    if (/contact/i.test(url)) {
      const country = (company.countryCode ?? undefined) as CountryCode | undefined;
      for (const found of findPhoneNumbersInText(text, country)) {
        if (!found.number.isValid() || found.number.nationalNumber.length < 8) continue;
        const phone = found.number.number;
        if (!seen.has(phone)) {
          seen.add(phone);
          findings.facts.push({ field: "phone", value: phone, sourceUrl: url, sourceType: "website" });
        }
      }
    }
  }

  const year = [...home.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)].map((m) => Number(m[1]));
  const latest = year.length ? Math.max(...year) : null;
  findings.signals.outdatedSite =
    !/<meta[^>]+name=["']viewport/i.test(home) || (latest !== null && latest <= now.getFullYear() - 4);
  findings.signals.noMobileApp = !/apps\.apple\.com|play\.google\.com\/store\/apps/i.test(home);
  findings.signals.hiringDevelopers =
    /(we['’]re hiring|join our team|careers|open (?:roles|positions))/i.test(allText) &&
    /\b(developer|software engineer|full[- ]stack|front[- ]end|back[- ]end|mobile engineer)\b/i.test(allText);
  return findings;
}

export const websiteProvider: PeopleProvider = {
  name: "website",

  disabledReason: (company) => (company.domain ? null : "no website known"),

  async run(company, _soFar, ctx): Promise<Findings> {
    const out = emptyFindings();
    const domain = company.domain!;
    const home =
      (await ctx.fetchText(`https://${domain}/`)) ?? (await ctx.fetchText(`https://www.${domain}/`));
    if (!home) return out;

    const pages = [{ url: home.url, html: home.text }];
    for (const url of keyPages(home.text, home.url, domain)) {
      const page = await ctx.fetchText(url);
      if (page) pages.push({ url: page.url, html: page.text });
    }

    const byName = new Map<string, PersonFinding>();
    for (const page of pages) {
      for (const person of extractPeople(page.html, page.url, company)) {
        if (!byName.has(person.name.toLowerCase())) byName.set(person.name.toLowerCase(), person);
      }
    }
    out.people = [...byName.values()];
    out.company = extractCompany(pages, company, ctx.now());
    return out;
  },
};
