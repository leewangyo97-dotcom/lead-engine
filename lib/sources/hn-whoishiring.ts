import type { NormalisedLead, SourceAdapter } from "./types";
import { truncateSummary } from "./types";
import { extractStack } from "./stack-map";
import { fetchJson } from "./fetch-json";

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

/**
 * Header fields are pipe-separated but in no fixed order. Posters write
 * "COMPANY | ROLE | LOCATION", "COMPANY | LOCATION | ROLE", and every
 * permutation with a URL, a salary or a visa note dropped in the middle.
 *
 * Taking fields[1] as the role produced titles like "Earth", "Full-time" and a
 * bare URL — which then reach the copywriter as the subject of the email. So
 * each field is classified by content, and the role is whatever is left over.
 */
const LOCATION_FIELD =
  /REMOTE|ONSITE|HYBRID|WORLDWIDE|ANYWHERE|\b(US|USA|EU|EMEA|APAC|UK)\b|,\s*[A-Z]{2}\b|\b(London|Berlin|Paris|NYC|New York|San Francisco|Bangalore|Singapore|Tokyo|Toronto|Amsterdam|Bremen)\b/i;

const TERMS_FIELD =
  /^(full[- ]?time|part[- ]?time|contract|freelance|intern(ship)?|permanent|equity|c2h|contract[- ]to[- ]hire|visa|no visa)\b|\bequity\b|^\$|^€|^£|\b\d{2,3}k\b/i;

const URL_FIELD = /^https?:\/\/|^www\./i;

/**
 * A field only counts as a role if it names a job.
 *
 * Without this, "B2B Saas / AI for AEC" and "Earth" survive as titles simply by
 * being neither a location nor a set of terms — and the copywriter then opens an
 * email with them. Many HN postings put the role in the body rather than the
 * header, and for those the correct answer is no lead, not a guessed one.
 */
const ROLE_WORD =
  /\b(engineer|engineering|developer|dev|swe|programmer|architect|sre|devops|designer|scientist|analyst|lead|manager|director|head of|intern|contractor|consultant|founding|full[- ]?stack|backend|back[- ]end|frontend|front[- ]end|mobile|android|ios|qa|data)\b/i;

export function pickRole(fields: string[]): string | null {
  // fields[0] is the company, so it is never a candidate.
  const candidates = fields.slice(1).map((f) => f.trim()).filter(Boolean);

  const usable = candidates.filter(
    (f) => !URL_FIELD.test(f) && !TERMS_FIELD.test(f) && f.length <= 160 && ROLE_WORD.test(f),
  );

  // Prefer a field that is only a role. A location that also names the role
  // ("Remote (EU) - Senior Rails Engineer") is the fallback, not the first pick.
  return usable.find((f) => !LOCATION_FIELD.test(f)) ?? usable[0] ?? null;
}

export function pickRegion(fields: string[]): string | undefined {
  return fields.slice(1).find((f) => LOCATION_FIELD.test(f))?.trim() || undefined;
}

export const hnWhoIsHiring: SourceAdapter<HnComment> = {
  id: "hn-whoishiring",
  label: "HN — Who is hiring?",

  async fetch(since: Date): Promise<HnComment[]> {
    // Algolia ANDs multi-word queries, so the thread is found by tag, not text.
    const stories = await fetchJson<{ hits: { objectID: string; title: string }[] }>(
      `${ALGOLIA}/search_by_date?tags=story,author_whoishiring&hitsPerPage=4`,
      { headers: { "User-Agent": UA } },
    );

    // Both recent threads, not just the newest. The harvest window is 45 days,
    // so on any day after the 1st the previous month's thread still contains
    // postings the filter would accept — and early in a month the current
    // thread is nearly empty. `since` does the actual date filtering, so
    // reading two costs nothing but a request.
    const threads = stories.hits.filter((h) => /who is hiring/i.test(h.title)).slice(0, 2);
    if (!threads.length) return [];

    const out: HnComment[] = [];
    for (const thread of threads) {
      // One request per second, per the adapter contract.
      for (let page = 0; page < 5; page++) {
        // Algolia returns intermittent 500s on individual pages. Skipping the
        // failed page and carrying on recovers the rest; stopping at the first
        // one discarded up to 70% of a harvest, and did it silently — which
        // looks exactly like a quiet week.
        let data: { hits: HnComment[]; nbPages: number };
        try {
          data = await fetchJson<{ hits: HnComment[]; nbPages: number }>(
            `${ALGOLIA}/search_by_date?tags=comment,story_${thread.objectID}&hitsPerPage=100&page=${page}`,
            { headers: { "User-Agent": UA } },
          );
        } catch (err) {
          console.error(
            `[hn-whoishiring] thread ${thread.objectID} page ${page} failed, skipping it: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
          continue;
        }
        out.push(...data.hits.filter((h) => new Date(h.created_at) >= since));
        if (page + 1 >= data.nbPages) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
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

    const company = fields[0].replace(/\s*\(\s*https?:[^)]*\)\s*/gi, "").trim();
    const title = pickRole(fields);
    // No identifiable role means the posting cannot be written about honestly.
    if (!company || !title || company.length > 120) return null;

    const body = rest.join(" ").trim();
    const email = text.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/)?.[0];
    const pay = parseHourlyUsd(headerLine);

    return {
      externalId: raw.objectID,
      kind: "job",
      company,
      title,
      region: pickRegion(fields) ?? (fields.slice(2).join(" | ") || undefined),
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
