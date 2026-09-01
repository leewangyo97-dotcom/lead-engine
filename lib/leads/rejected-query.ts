import { desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { NEEDS_DRAFT_THRESHOLD } from "../scoring/prescore";
import { events, leads, scores } from "../db/schema";

export interface RejectedRow {
  id: string;
  company: string;
  title: string;
  status: string;
  score: number | null;
  reason: string | null;
  sourceId: string;
}

/**
 * What the filter turned away, and why.
 *
 * The inbox answers "what should I do today". This answers "why is there
 * nothing to do", which is the question that matters when the funnel is dry —
 * and the one a status column alone cannot answer.
 */
export async function getRejected(limit = 200): Promise<RejectedRow[]> {
  const db = getDb();

  const rows = await db
    .select({
      id: leads.id,
      company: leads.company,
      title: leads.title,
      status: leads.status,
      sourceId: leads.sourceId,
      // Subqueries, not a join: scores is append-only, so joining multiplies
      // the lead once it has been judged more than once.
      score: sql<number | null>`(
        select coalesce(s.model_score, s.pre_score) from ${scores} s
        where s.lead_id = ${leads.id} order by s.scored_at desc limit 1
      )`,
      modelReason: sql<string | null>`(
        select s.reason from ${scores} s where s.lead_id = ${leads.id}
        order by s.scored_at desc limit 1
      )`,
    })
    .from(leads)
    .where(inArray(leads.status, ["disqualified", "parked"]))
    .orderBy(desc(sql`(
      select coalesce(s.model_score, s.pre_score) from ${scores} s
      where s.lead_id = ${leads.id} order by s.scored_at desc limit 1
    )`))
    .limit(limit);

  // Disqualified leads have no score row, so their reason comes from the event
  // the pre-filter writes.
  const reasons = await db
    .select({ leadId: events.leadId, meta: events.meta })
    .from(events)
    .where(eq(events.type, "disqualified"));

  const byLead = new Map<string, string>();
  for (const r of reasons) {
    const reason = (r.meta as { reason?: string } | null)?.reason;
    if (r.leadId && reason && !byLead.has(r.leadId)) byLead.set(r.leadId, reason);
  }

  // A parked lead was not rejected by a rule — it simply did not score enough.
  // Saying "no reason recorded" would imply something went missing.
  const GATE = NEEDS_DRAFT_THRESHOLD - 15;

  return rows.map((r) => ({
    id: r.id,
    company: r.company,
    title: r.title,
    status: r.status,
    score: r.score,
    sourceId: r.sourceId,
    reason:
      byLead.get(r.id) ??
      r.modelReason ??
      (r.status === "parked" && r.score != null ? `scored ${r.score}, under the ${GATE} gate` : null),
  }));
}
