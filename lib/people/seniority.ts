/**
 * How senior a job title is, in the five bands the filters use.
 *
 * A freelancer's buyer is whoever can say yes to a budget: the owner of a small
 * business, a founder, the C-suite, or the VP or head of the department that
 * would use the software. Directors are often that buyer at mid-size firms.
 * Everyone else may be a champion, but is not the decision.
 */
export type Seniority = "c_level" | "founder_owner" | "vp" | "director" | "other";

export const SENIORITY_LABEL: Record<Seniority, string> = {
  c_level: "C-level",
  founder_owner: "Founder / Owner",
  vp: "VP / Head of",
  director: "Director",
  other: "Other",
};

const BANDS: [Seniority, RegExp][] = [
  // Founders first: "Founder & CEO" is a founder who also runs the company.
  [
    "founder_owner",
    /\b(co-?founder|founder|owner|proprietor|principal(?! (?:engineer|developer|designer|consultant))|managing partner)\b/i,
  ],
  [
    "c_level",
    /\b(ceo|cto|coo|cfo|cio|cmo|cpo|chief\b|president(?! of)|managing director|general manager|executive officer)\b/i,
  ],
  ["vp", /\b(vp|svp|evp|vice[- ]president|head of)\b/i],
  ["director", /\bdirector\b/i],
];

export function seniorityOf(title: string | null | undefined): Seniority {
  if (!title) return "other";
  for (const [band, pattern] of BANDS) if (pattern.test(title)) return band;
  return "other";
}

/** Whether a title is worth keeping at all: the buyer bands only. */
export function isDecisionMaker(title: string | null | undefined): boolean {
  return seniorityOf(title) !== "other";
}
