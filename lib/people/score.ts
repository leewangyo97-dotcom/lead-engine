import type { Seniority } from "./seniority";

/**
 * How good a decision-maker is to approach, 0–100.
 *
 * Four questions, each weighted below. Can this person say yes (seniority)?
 * Is the company the right size to hire a freelancer or small agency? Does it
 * show signs of needing software work? Can they actually be reached?
 *
 * The weights are a starting point, not a finding: no reply data yet. Change
 * them here or pass overrides to `scorePerson`. /review will say which signals
 * replies come from once outcomes are logged.
 */
export const PEOPLE_WEIGHTS = {
  seniority: { founder_owner: 30, c_level: 28, vp: 20, director: 14, other: 3 } as Record<Seniority, number>,
  /** Small and mid-size firms hire freelancers and small agencies; enterprises buy from vendors. */
  companySize: { "1-10": 12, "11-50": 15, "51-200": 12, "201-1000": 6, "1000+": 2, unknown: 6 } as Record<string, number>,
  /** An industry that commonly buys custom web and mobile work. */
  industryFit: 8,
  signals: {
    hiringDevelopers: 15,
    recentFunding: 12,
    outdatedSite: 8,
    noMobileApp: 5,
  },
  contact: {
    /** Published by the company itself: the address they read. */
    verified: 15,
    /** Research only, never sent, so it adds little. */
    guessed: 3,
    phone: 3,
    linkedin: 2,
  },
};

export type PeopleWeights = typeof PEOPLE_WEIGHTS;

/** Industries that commonly commission custom software, matched loosely. */
const FIT = /(software|saas|tech|startup|fintech|health|clinic|dental|medical|education|retail|e-?commerce|logistics|real estate|property|hospitality|restaurant|travel|media|marketing|agency|finance|insurance|legal|professional services)/i;

export interface ScorablePerson {
  seniority: Seniority;
  emailStatus: "verified" | "guessed" | "unknown";
  phone?: string | null;
  linkedinUrl?: string | null;
}

export interface ScorableCompany {
  sizeBand?: string | null;
  industry?: string | null;
  signals?: Record<string, unknown> | null;
}

export function scorePerson(
  person: ScorablePerson,
  company: ScorableCompany,
  weights: PeopleWeights = PEOPLE_WEIGHTS,
): { score: number; reasons: Record<string, number> } {
  const reasons: Record<string, number> = {};
  reasons.seniority = weights.seniority[person.seniority] ?? 0;
  reasons.companySize = weights.companySize[company.sizeBand ?? "unknown"] ?? weights.companySize.unknown;
  if (company.industry && FIT.test(company.industry)) reasons.industryFit = weights.industryFit;

  const signals = company.signals ?? {};
  for (const [signal, points] of Object.entries(weights.signals)) {
    if (signals[signal] === true) reasons[signal] = points;
  }

  if (person.emailStatus === "verified") reasons.emailVerified = weights.contact.verified;
  else if (person.emailStatus === "guessed") reasons.emailGuessed = weights.contact.guessed;
  if (person.phone) reasons.phone = weights.contact.phone;
  if (person.linkedinUrl) reasons.linkedin = weights.contact.linkedin;

  const raw = Object.values(reasons).reduce((sum, n) => sum + n, 0);
  return { score: Math.max(0, Math.min(100, raw)), reasons };
}
