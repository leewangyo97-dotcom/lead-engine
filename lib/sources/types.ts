export type RemoteScope = "worldwide" | "apac" | "emea" | "us" | "onsite";
export type LeadKind = "job" | "funding" | "cofounder";

/**
 * The only shape downstream code sees. An adapter is the sole place that knows
 * about a specific website; a site redesign is therefore a one-file breakage.
 */
export interface NormalisedLead {
  externalId?: string;
  kind: LeadKind;
  company: string;
  title: string;
  region?: string; // verbatim from the posting
  remoteScope?: RemoteScope;
  isContract: boolean;
  contact?: string; // email if the posting gives one
  isDirect: boolean; // personal inbox, not an ATS or role alias
  url?: string;
  payRaw?: string;
  payMinUsdHr?: number; // only when derivable; never guessed
  stack: string[]; // normalised lowercase tokens
  summary?: string; // truncated to 400 chars at ingest
  triggerEvent?: string;
  postedAt?: Date;
}

export interface SourceAdapter<Raw = unknown> {
  id: string;
  label: string;
  /** Network only, no parsing. */
  fetch(since: Date): Promise<Raw[]>;
  /** Pure. No network. Returns null for unparseable input; never throws. */
  normalise(raw: Raw): NormalisedLead | null;
}

export const SUMMARY_MAX = 400;

export function truncateSummary(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= SUMMARY_MAX ? clean : clean.slice(0, SUMMARY_MAX);
}
