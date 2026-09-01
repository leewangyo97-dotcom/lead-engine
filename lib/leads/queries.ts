import { desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { leads, scores } from "../db/schema";

/**
 * The latest score for a lead, as a correlated subquery rather than a join.
 *
 * `scores` is intentionally append-only — a lead re-judged under a new rubric
 * version keeps its old row so the learning loop can compare like with like.
 * Joining on it therefore multiplies the lead: a second score row made
 * Risklytics appear twice in the inbox, with no error anywhere.
 */
const latestScore = sql<number | null>`(
  select coalesce(s.model_score, s.pre_score) from ${scores} s
  where s.lead_id = ${leads.id} order by s.scored_at desc limit 1
)`;

const latestTier = sql<string | null>`(
  select s.tier from ${scores} s where s.lead_id = ${leads.id}
  order by s.scored_at desc limit 1
)`;

/** What the inbox shows. Deliberately narrow — the list must stay cheap. */
export type InboxRow = {
  id: string;
  company: string;
  title: string;
  region: string | null;
  remoteScope: string | null;
  overlapHours: number | null;
  stack: string[];
  isContract: boolean;
  isDirect: boolean;
  payRaw: string | null;
  postedAt: Date | null;
  triggerEvent: string | null;
  status: string;
  score: number | null;
  tier: string | null;
};

/** Statuses that belong in the morning triage. Everything else is history. */
export const TRIAGE_STATUSES = ["needs_scoring", "scored", "needs_draft", "harvested"] as const;

export async function getInbox(): Promise<InboxRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: leads.id,
      company: leads.company,
      title: leads.title,
      region: leads.region,
      remoteScope: leads.remoteScope,
      overlapHours: leads.overlapHours,
      stack: leads.stack,
      isContract: leads.isContract,
      isDirect: leads.isDirect,
      payRaw: leads.payRaw,
      postedAt: leads.postedAt,
      triggerEvent: leads.triggerEvent,
      status: leads.status,
      score: latestScore,
      tier: latestTier,
    })
    .from(leads)
    .where(inArray(leads.status, [...TRIAGE_STATUSES]))
    .orderBy(desc(latestScore), desc(leads.harvestedAt));

  return rows as InboxRow[];
}

export async function getLead(id: string) {
  const db = getDb();
  const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  if (!lead) return null;

  // Newest first, so a lead re-scored under a later rubric shows that score.
  const [score] = await db
    .select()
    .from(scores)
    .where(eq(scores.leadId, id))
    .orderBy(desc(scores.scoredAt))
    .limit(1);

  return { leads: lead, scores: score ?? null };
}

export function tierOf(score: number | null): "live" | "warn" | "cold" {
  if (score == null) return "cold";
  return score >= 75 ? "live" : score >= 60 ? "warn" : "cold";
}
