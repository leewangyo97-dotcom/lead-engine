import { desc, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "../db";
import { leads, scores } from "../db/schema";
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
 * with counts: rescore every lead the weights turned away under a hypothetical
 * and report how many clear the threshold.
 *
 * Nothing here writes. Changing a weight remains a commit against
 * memory/RUBRIC.md with a version bump, so old scores stay interpretable.
 */
export async function getScenarios(): Promise<Scenario[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(leads)
    .where(inArray(leads.status, ["parked", "needs_scoring"]));

  // Disqualified leads are not here at all. A disqualifier — region-locked,
  // Rust as the primary language, a non-engineering role — is a rule, not a
  // weight, and no reweighting clears it; including them had two Proxybase
  // Rust roles "qualifying at 76" under the full-time scenario.
  //
  // Where the model has judged a lead, its verdict is held fixed and only the
  // change the weights make is added to it. Rescoring those with the rubric
  // alone had "as scored today" list Lucia at 92 and Search Atlas at 83 as
  // qualifying, on the page that shows them turned away: the model scored both
  // 0 as not engineering roles. Held fixed, a reweighting moves Lucia to 5,
  // while a lead the model trimmed by six points can still clear the gate.
  const judged = await db
    .select({ leadId: scores.leadId, modelScore: scores.modelScore, scoredAt: scores.scoredAt })
    .from(scores)
    .where(isNotNull(scores.modelScore))
    .orderBy(desc(scores.scoredAt));
  const modelScore = new Map<string, number>();
  for (const j of judged) {
    if (!modelScore.has(j.leadId)) modelScore.set(j.leadId, j.modelScore!); // newest first
  }

  const now = new Date();

  const run = (mutate: (lead: (typeof rows)[number]) => Parameters<typeof prescore>[0]) => {
    const hits = rows
      .map((lead) => {
        const scenario = prescore(mutate(lead), now).score;
        const model = modelScore.get(lead.id);
        const score =
          model == null ? scenario : model + (scenario - prescore(fromLead(lead), now).score);
        return { company: lead.company, score };
      })
      .filter((r) => r.score >= NEEDS_DRAFT_THRESHOLD)
      .sort((a, b) => b.score - a.score);

    return {
      qualifying: hits.length,
      examples: hits.slice(0, 3).map((h) => `${h.company} ${h.score}`),
    };
  };

  const asIs = run((lead) => fromLead(lead));

  // Scores a full-time posting as a contract one. Full-time has counted since
  // rubric 1.2.0 (15 of 20); what is left open is whether the five-point
  // preference for contract work is costing anything.
  const fullTimeOk = run((lead) => ({ ...fromLead(lead), isContract: true }));

  return [
    { key: "current", label: "As scored today", ...asIs },
    { key: "fulltime", label: "If full-time scored the same as contract", ...fullTimeOk },
  ];
}
