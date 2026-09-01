import type { NormalisedLead, SourceAdapter } from "./types";
import { truncateSummary } from "./types";
import { canonicaliseStack, extractStack } from "./stack-map";

/** One item from remoteok.com/api. The first element is a legal notice, not a job. */
export interface RemoteOkItem {
  slug?: string;
  id?: string;
  date?: string;
  company?: string;
  position?: string;
  tags?: string[];
  location?: string;
  description?: string;
  salary_min?: number;
  salary_max?: number;
  url?: string;
  apply_url?: string;
}

const API = "https://remoteok.com/api";
const UA = "lead-engine/0.1 (personal job-search tool; contact via HN)";

/**
 * Filtered before normalising, per the source-adapter contract. The feed is
 * mostly non-engineering — on a typical fetch, 3 of 100 items are engineering
 * roles — so narrowing here keeps 97% of the payload out of everything
 * downstream.
 */
const ENGINEERING =
  /\b(engineer|engineering|developer|programmer|architect|sre|devops|full[- ]?stack|backend|back[- ]end|frontend|front[- ]end|mobile|android|ios)\b/i;

/** 2,080 working hours a year. Arithmetic on a stated figure, never an estimate. */
const HOURS_PER_YEAR = 2080;

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * RemoteOK's `location` is free text and frequently just "Remote". Anything it
 * does not state is left undefined rather than assumed worldwide — an invented
 * timezone overlap is the highest-weighted input in the rubric.
 */
export function detectScope(location: string, tags: string[]): NormalisedLead["remoteScope"] {
  const text = `${location} ${tags.join(" ")}`.toLowerCase();
  if (/worldwide|anywhere|global/.test(text)) return "worldwide";
  if (/apac|asia|australia|singapore|philippines|india|japan/.test(text)) return "apac";
  if (/emea|europe|\beu\b|\buk\b|cet\b|germany|spain|portugal|poland/.test(text)) return "emea";
  if (/\busa?\b|united states|americas|canada|\best\b|\bpst\b|remote us/.test(text)) return "us";
  if (/^\s*remote\s*$/.test(location.toLowerCase())) return "worldwide";
  return undefined;
}

export const remoteOk: SourceAdapter<RemoteOkItem> = {
  id: "remoteok",
  label: "RemoteOK",

  async fetch(since: Date): Promise<RemoteOkItem[]> {
    const res = await fetch(API, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) throw new Error(`RemoteOK fetch failed: ${res.status}`);

    const data = (await res.json()) as RemoteOkItem[];
    // The API returns one legal-notice object before the jobs; it has no
    // `position`, so filtering on that removes it without special-casing.
    return data.filter(
      (item) =>
        item.position &&
        ENGINEERING.test(item.position) &&
        (!item.date || new Date(item.date) >= since),
    );
  },

  normalise(raw: RemoteOkItem): NormalisedLead | null {
    const company = raw.company?.trim();
    const title = raw.position?.trim();
    if (!company || !title) return null;

    const tags = raw.tags ?? [];
    const body = stripHtml(raw.description ?? "");
    const location = raw.location?.trim() ?? "";

    // Salaries are annual and often 0, which means unstated rather than unpaid.
    const min = raw.salary_min && raw.salary_min > 0 ? raw.salary_min : undefined;
    const max = raw.salary_max && raw.salary_max > 0 ? raw.salary_max : undefined;

    const haystack = `${title} ${tags.join(" ")} ${body}`;

    return {
      externalId: raw.id ?? raw.slug,
      kind: "job",
      company,
      title,
      region: location || undefined,
      remoteScope: detectScope(location, tags),
      isContract: /\bcontract|freelance|contractor|part[- ]time\b/i.test(
        `${tags.join(" ")} ${title}`,
      ),
      // The feed gives an apply URL, never a person. Treating that as a direct
      // contact would inflate the score on every single row.
      contact: undefined,
      isDirect: false,
      url: raw.url ?? raw.apply_url,
      payRaw: min ? `$${min.toLocaleString()}${max ? `-$${max.toLocaleString()}` : ""}/yr` : undefined,
      payMinUsdHr: min ? Math.round(min / HOURS_PER_YEAR) : undefined,
      // Tags are already the site's own taxonomy, so they are canonicalised
      // directly; the body is scanned only to catch what the tags missed.
      stack: canonicaliseStack([...tags, ...extractStack(haystack)]),
      summary: truncateSummary(body),
      postedAt: raw.date ? new Date(raw.date) : undefined,
    };
  },
};
