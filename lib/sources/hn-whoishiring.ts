import type { NormalisedLead, SourceAdapter } from "./types";
import { truncateSummary } from "./types";
import { extractStack } from "./stack-map";

/** One top-level comment in a "Who is hiring?" thread. */
export interface HnComment {
  objectID: string;
  author: string;
  story_id: number;
  parent_id: number;
  story_title?: string;
  created_at: string;
  created_at_i?: number;
  comment_text: string | null;
}

const ALGOLIA = "https://hn.algolia.com/api/v1";
const UA = "lead-engine/0.1 (personal job-search tool; contact via HN)";

/** Postings are one line of pipe-separated fields, then an HTML body. */
const FIELD_SEP = "|";

const ATS_HOSTS = [
  "greenhouse.io",
  "lever.co",
  "ashbyhq",
  "workable",
  "breezy.hr",
  "recruitee",
  "smartrecruiters",
  "jobvite",
  "bamboohr",
  "workday",
];

/** Role aliases, not a human's inbox. See the source-adapter skill, rule 5. */
const ROLE_ALIASES = [
  "jobs",
  "careers",
  "hiring",
  "recruiting",
  "recruitment",
  "hr",
  "talent",
  "apply",
  "work",
  "join",
  "team",
  "info",
  "hello",
  "contact",
  "admin",
  "support",
];

export function decodeEntities(s: string): string {
  return s
    .replace(/<p>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x2F;/g, "/")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ");
}

export function detectRemoteScope(header: string): NormalisedLead["remoteScope"] {
  const h = header.toLowerCase();
  if (!/remote/.test(h)) return h.includes("onsite") ? "onsite" : undefined;
  if (/worldwide|anywhere|global/.test(h)) return "worldwide";
  if (/apac|asia|australia|singapore|philippines|india/.test(h)) return "apac";
  if (/emea|europe|eu\b|uk\b|cet\b/.test(h)) return "emea";
  if (/\bus\b|usa|united states|americas|canada|est\b|pst\b/.test(h)) return "us";
  return "worldwide"; // bare "REMOTE" with no qualifier
}

export function detectContract(text: string): boolean {
  return /\bcontract\b|\bcontractor\b|\bfreelance\b|\bconsulting\b|contract-to-hire|\bc2h\b|\bpart[- ]time\b/i.test(
    text,
  );
}

export function isDirectContact(email: string): boolean {
  const [local, domain = ""] = email.toLowerCase().split("@");
  if (ATS_HOSTS.some((h) => domain.includes(h))) return false;
  const stem = local.split(/[.+_-]/)[0];
  return !ROLE_ALIASES.includes(stem) && !ROLE_ALIASES.includes(local);
}

/** Only when explicitly stated. A guessed rate is a fabricated fact. */
export function parseHourlyUsd(text: string): { raw?: string; minUsdHr?: number } {
  const hourly = text.match(/\$\s?(\d{2,3})\s?(?:-|–|to)?\s?\$?(\d{2,3})?\s?\/?\s?(?:hr|hour)/i);
  if (hourly) {
    return { raw: hourly[0].trim(), minUsdHr: Number(hourly[1]) };
  }
  // "$170-240K" states the K once, at the end of the range — so the unit is
  // optional on the lower bound and required on the upper.
  const annual = text.match(
    /\$\s?(\d{2,3})\s?(?:,000|k)?\s?(?:-|–|to)\s?\$?\s?(\d{2,3})\s?(?:,000|k)/i,
  );
  if (annual) {
    // 2,080 working hours a year. Stated salary, arithmetic only — not a guess.
    return { raw: annual[0].trim(), minUsdHr: Math.round((Number(annual[1]) * 1000) / 2080) };
  }
  return {};
}

export const hnWhoIsHiring: SourceAdapter<HnComment> = {
  id: "hn-whoishiring",
  label: "HN — Who is hiring?",

  async fetch(since: Date): Promise<HnComment[]> {
    // Algolia ANDs multi-word queries, so the thread is found by tag, not text.
    const storyRes = await fetch(
      `${ALGOLIA}/search_by_date?tags=story,author_whoishiring&hitsPerPage=4`,
      { headers: { "User-Agent": UA } },
    );
    if (!storyRes.ok) throw new Error(`HN story lookup failed: ${storyRes.status}`);
    const stories = (await storyRes.json()) as { hits: { objectID: string; title: string }[] };

    const thread = stories.hits.find((h) => /who is hiring/i.test(h.title));
    if (!thread) return [];

    const out: HnComment[] = [];
    // One request per second, per the adapter contract.
    for (let page = 0; page < 5; page++) {
      const res = await fetch(
        `${ALGOLIA}/search_by_date?tags=comment,story_${thread.objectID}&hitsPerPage=100&page=${page}`,
        { headers: { "User-Agent": UA } },
      );
      if (!res.ok) break;
      const data = (await res.json()) as { hits: HnComment[]; nbPages: number };
      out.push(...data.hits.filter((h) => new Date(h.created_at) >= since));
      if (page + 1 >= data.nbPages) break;
      await new Promise((r) => setTimeout(r, 1000));
    }

    // Replies are conversation, not postings. Only top-level comments are jobs.
    return out.filter((h) => String(h.parent_id) === String(h.story_id));
  },

  normalise(raw: HnComment): NormalisedLead | null {
    const text = decodeEntities(raw.comment_text ?? "").trim();
    if (!text) return null;

    const [headerLine, ...rest] = text.split("\n");
    const fields = headerLine.split(FIELD_SEP).map((f) => f.trim());
    // A posting without at least "COMPANY | ROLE" is unparseable. Return null;
    // one bad record must not end the run.
    if (fields.length < 2 || !fields[0]) return null;

    const company = fields[0];
    const title = fields[1];
    if (!company || !title || company.length > 120 || title.length > 160) return null;

    const body = rest.join(" ").trim();
    const email = text.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/)?.[0];
    const pay = parseHourlyUsd(headerLine);

    return {
      externalId: raw.objectID,
      kind: "job",
      company,
      title,
      region: fields.slice(2).join(" | ") || undefined,
      remoteScope: detectRemoteScope(headerLine),
      isContract: detectContract(headerLine),
      contact: email,
      isDirect: email ? isDirectContact(email) : false,
      url: `https://news.ycombinator.com/item?id=${raw.objectID}`,
      payRaw: pay.raw,
      payMinUsdHr: pay.minUsdHr,
      stack: extractStack(text),
      summary: truncateSummary(body || headerLine),
      postedAt: new Date(raw.created_at),
    };
  },
};
