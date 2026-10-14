/**
 * The provider contract: one module per public source, each adding what it
 * finds about a company and its decision-makers, with where it found it.
 *
 * Providers run in order, and each sees what the ones before it found, so the
 * email-pattern provider can learn a format from addresses the website
 * provider read. A provider never writes to the database: the pipeline
 * (discover.ts) merges, applies the guardrails and stores, in one place.
 *
 * To add a source, see the README section "Decision-makers: adding a provider".
 */

export type SourceType = "website" | "email_pattern" | "edgar" | "github" | "manual";

export interface CompanyRef {
  id: string;
  name: string;
  /** Lower-case domain, or null when none is known. */
  domain: string | null;
  countryCode: string | null;
}

/** One fact, and where it was read. Becomes a `people_sources` row. */
export interface Fact {
  field: string;
  value: string;
  sourceUrl: string | null;
  sourceType: SourceType;
}

export interface PersonFinding {
  name: string;
  title?: string;
  email?: string;
  emailStatus?: "verified" | "guessed";
  /** A business number the company published for this person. */
  phone?: string;
  /** Kept as a link. LinkedIn is never fetched. */
  linkedinUrl?: string;
  facts: Fact[];
}

export interface CompanyFinding {
  industry?: string;
  sizeBand?: string;
  location?: string;
  /** Need signals and stack: outdatedSite, noMobileApp, hiringDevelopers, recentFunding, techStack… */
  signals: Record<string, unknown>;
  facts: Fact[];
}

export interface Findings {
  people: PersonFinding[];
  company: CompanyFinding;
}

export function emptyFindings(): Findings {
  return { people: [], company: { signals: {}, facts: [] } };
}

export interface Fetched {
  url: string;
  status: number;
  text: string;
}

export interface ProviderContext {
  /**
   * A polite GET: robots.txt honoured for web pages, at most one request a
   * second per host, cached for the run. Null when refused, failed or blocked.
   */
  fetchText(url: string, init?: { headers?: Record<string, string>; robots?: boolean }): Promise<Fetched | null>;
  /** Whether a domain receives mail at all. */
  hasMx(domain: string): Promise<boolean>;
  env: Record<string, string | undefined>;
  now(): Date;
}

export interface PeopleProvider {
  name: SourceType;
  /** Why the provider is skipped for this company (no key, no domain, not US…), or null. */
  disabledReason(company: CompanyRef, env: Record<string, string | undefined>): string | null;
  run(company: CompanyRef, soFar: Findings, ctx: ProviderContext): Promise<Findings>;
}
