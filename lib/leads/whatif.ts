import { inArray } from "drizzle-orm";
import { getDb } from "../db";
import { leads } from "../db/schema";
import { fromLead, prescore, NEEDS_DRAFT_THRESHOLD } from "../scoring/prescore";

export interface Scenario {
  key: string;
  label: string;
  qualifying: number;
  examples: string[];
}

/**
 * What the funnel would look like under a different rubric — computed, never
 * applied.
 *
 * The contract weight has been the open question since the first harvest, and
 * arguing it from intuition is exactly what RUBRIC.md forbids. This answers it
 * with counts: rescore every rejected lead under a hypothetical and report how
 * many clear the threshold.
 *
 * Nothing here writes. Changing a weight remains a commit against
 * memory/RUBRIC.md with a version bump, so old scores stay interpretable.
 */
export async function getScenarios(): Promise<Scenario[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(leads)
    .where(inArray(leads.status, ["parked", "disqualified", "needs_scoring"]));

  const now = new Date();

  const run = (mutate: (lead: (typeof rows)[number]) => Parameters<typeof prescore>[0]) => {
    const hits = rows
      .map((lead) => ({ company: lead.company, result: prescore(mutate(lead), now) }))
      .filter((r) => r.result.score >= NEEDS_DRAFT_THRESHOLD)
      .sort((a, b) => b.result.score - a.result.score);

    return {
      qualifying: hits.length,
      examples: hits.slice(0, 3).map((h) => `${h.company} ${h.result.score}`),
    };
  };

  const asIs = run((lead) => fromLead(lead));

  // Treats a full-time posting as acceptable terms rather than a 15-point
  // penalty. This is the question PROFILE.md records as unresolved.
  const fullTimeOk = run((lead) => ({ ...fromLead(lead), isContract: true }));

  return [
    { key: "current", label: "As scored today", ...asIs },
    { key: "fulltime", label: "If full-time counted as acceptable terms", ...fullTimeOk },
  ];
}
