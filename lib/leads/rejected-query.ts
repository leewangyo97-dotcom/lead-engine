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
export const REJECTED_PAGE_SIZE = 50;

export async function getRejected(limit = REJECTED_PAGE_SIZE): Promise<RejectedRow[]> {
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
        select coalesce(s.model_score, s.pre_score) from scores s
        where s.lead_id = leads.id order by s.scored_at desc limit 1
      )`,
      modelReason: sql<string | null>`(
        select s.reason from scores s where s.lead_id = leads.id
        order by s.scored_at desc limit 1
      )`,
    })
    .from(leads)
    .where(inArray(leads.status, ["disqualified", "parked"]))
    .orderBy(desc(sql`(
      select coalesce(s.model_score, s.pre_score) from scores s
      where s.lead_id = leads.id order by s.scored_at desc limit 1
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

/**
 * The tally, counted in SQL over every rejected lead.
 *
 * Rendering all of them to derive it produced a 757 KB page — fine on a desktop,
 * wasteful on a phone, and the tally is the part worth reading. The list is
 * capped; the counts are not.
 */
export async function getRejectedTally(): Promise<{ reason: string; n: number }[]> {
  const db = getDb();
  const rows = await db.execute(sql`
    select coalesce(
             case when l.status = 'parked' then 'scored under the gate' end,
             (select e.meta->>'reason' from events e
              where e.lead_id = l.id and e.type = 'disqualified'
              order by e.created_at desc limit 1),
             'no reason recorded'
           ) as reason,
           count(*)::int as n
    from leads l
    where l.status in ('disqualified', 'parked')
    group by 1 order by n desc
  `);
  return rows.rows as { reason: string; n: number }[];
}

export async function getRejectedCount(): Promise<number> {
  const db = getDb();
  const rows = await db.execute(
    sql`select count(*)::int as n from leads where status in ('disqualified','parked')`,
  );
  return (rows.rows[0] as { n: number })?.n ?? 0;
}

/**
 * Score distribution of everything the gate turned away.
 *
 * A tally by reason says what was rejected; this says how close any of it came.
 * The difference matters: a funnel clustered just under the gate is a threshold
 * problem, and one peaking twenty points below is a supply problem. Guessing
 * between those two is how a rubric gets tuned on a hunch.
 */
export async function getScoreBands(): Promise<{ band: string; n: number }[]> {
  const db = getDb();
  const rows = await db.execute(sql`
    select (width_bucket(coalesce(s.model_score, s.pre_score), 0, 100, 10) - 1) * 10 as low,
           count(*)::int as n
    from leads l join scores s on s.lead_id = l.id
    where l.status in ('parked', 'disqualified')
    group by 1 order by 1
  `);
  return (rows.rows as { low: number; n: number }[]).map((r) => ({
    band: `${r.low}-${r.low + 9}`,
    n: r.n,
  }));
}

