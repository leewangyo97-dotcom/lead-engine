import type { NormalisedLead, SourceAdapter } from "./types";
import { truncateSummary } from "./types";
import { extractStack } from "./stack-map";
import { decodeEntities, isDirectContact } from "./hn-whoishiring";

/** A "Launch HN" story: a founder announcing a newly funded company. */
export interface LaunchHnStory {
  objectID: string;
  author: string;
  title: string;
  url?: string;
  created_at: string;
  story_text: string | null;
}

const ALGOLIA = "https://hn.algolia.com/api/v1";
const UA = "lead-engine/0.1 (personal job-search tool; contact via HN)";

/**
 * Founders who have just launched, rather than companies running a hiring
 * pipeline.
 *
 * The source survey in memory/DECISIONS.md found that free job boards carry
 * almost no contract work with a named human contact — 30 of the rubric's 100
 * points describe something those feeds structurally lack. A Launch HN post is
 * the opposite shape: no stated region or terms, but a dated trigger and often
 * the founder's own inbox.
 */
/** Sentences that state what a company builds with, rather than merely mention it. */
const BUILD_CONTEXT =
  /\b(built|build|building|wrote|written|rewrote|use|uses|using|powered by|runs on|stack|backend|frontend|codebase|migrat\w+|port\w+)\b/i;

/**
 * A launch post is a pitch, not a job spec.
 *
 * Scanning the whole post put `typescript` and `postgres` on machine0 — a GPU
 * VM company — because both words appear in passing, and that inflated it to 81
 * and past the draft threshold. Only sentences that say what the company builds
 * with are considered, so an aside about someone else's stack does not count as
 * a match.
 */
export function extractStackFromBuildContext(text: string): string[] {
  const sentences = text.split(/(?<=[.!?\n])\s+/);
  const relevant = sentences.filter((s) => BUILD_CONTEXT.test(s)).join(" ");
  return extractStack(relevant);
}

export const launchHn: SourceAdapter<LaunchHnStory> = {
  id: "launch-hn",
  label: "Launch HN (newly funded)",

  async fetch(since: Date): Promise<LaunchHnStory[]> {
    const res = await fetch(
      `${ALGOLIA}/search_by_date?tags=story&query=Launch%20HN&hitsPerPage=100` +
        `&numericFilters=created_at_i>${Math.floor(since.getTime() / 1000)}`,
      { headers: { "User-Agent": UA } },
    );
    if (!res.ok) throw new Error(`Launch HN fetch failed: ${res.status}`);

    const data = (await res.json()) as { hits: LaunchHnStory[] };
    // Algolia matches "launch" and "HN" anywhere, so the prefix is checked here
    // rather than trusted from the query.
    return data.hits.filter((h) => /^Launch HN:/i.test(h.title ?? ""));
  },

  normalise(raw: LaunchHnStory): NormalisedLead | null {
    const title = (raw.title ?? "").trim();
    if (!/^Launch HN:/i.test(title)) return null;

    // "Launch HN: Almanac (YC S26) – AI that knows your company"
    const rest = title.replace(/^Launch HN:\s*/i, "");
    const company = rest.split(/\s+[–—-]\s+/)[0].replace(/\s*\(YC [A-Z]\d{2}\)\s*/i, "").trim();
    const pitch = rest.split(/\s+[–—-]\s+/).slice(1).join(" - ").trim();
    if (!company || company.length > 120) return null;

    const body = decodeEntities(raw.story_text ?? "");
    const email = body.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/)?.[0];
    const batch = rest.match(/\(YC ([A-Z]\d{2})\)/i)?.[1];

    const postedAt = new Date(raw.created_at);
    const days = Math.max(0, Math.floor((Date.now() - postedAt.getTime()) / 86_400_000));

    return {
      externalId: raw.objectID,
      kind: "funding",
      company,
      // Not a job posting. The role is what Joshua proposes, so the title says
      // who is being contacted rather than inventing a vacancy that may not exist.
      title: `Founder — ${pitch || company}`.slice(0, 160),
      // Deliberately unset: a Launch HN post states no region and no terms, and
      // guessing either would put an invented fact into the scoring input.
      region: undefined,
      remoteScope: undefined,
      isContract: false,
      contact: email,
      isDirect: email ? isDirectContact(email) : false,
      url: `https://news.ycombinator.com/item?id=${raw.objectID}`,
      stack: extractStackFromBuildContext(`${title}. ${body}`),
      summary: truncateSummary(body || pitch),
      triggerEvent: batch
        ? `launched on HN ${days}d ago, YC ${batch}`
        : `launched on HN ${days}d ago`,
      postedAt,
    };
  },
};
