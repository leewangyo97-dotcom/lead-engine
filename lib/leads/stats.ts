import { sql } from "drizzle-orm";
import { getDb } from "../db";

export interface InboxStats {
  harvested: number;
  drafted: number;
  sent: number;
  replied: number;
  scoreAvg: number | null;
  lastRunAt: Date | null;
}

/**
 * The five tiles from `inbox-populated-lg` (Figma 3:787), with the captions the
 * design gives them: HARVESTED "since Monday", DRAFTED "pending review", SENT
 * "this week", REPLIED "leads engaged", SCORE AVG "quality threshold".
 *
 * One round trip. Five separate counts on a page that renders in a sidebar's
 * shadow is five times the latency for no benefit.
 */
export async function getInboxStats(): Promise<InboxStats> {
  const db = getDb();

  const rows = await db.execute(sql`
    select
      (select count(*)::int from leads
         where harvested_at >= date_trunc('week', now())) as harvested,
      -- Leads whose newest draft is still unverified.
      --
      -- Two things this avoids. Prospect messages share this table, so counting
      -- every unverified row made an enhanced WhatsApp message look like a job
      -- application awaiting review. And a draft the verifier rejected stays in
      -- the table as the record of what was refused; once a rewrite passes, that
      -- older row is history, not work.
      (select count(*)::int from (
         select distinct on (lead_id) lead_id, verified_at
         from outreach
         where lead_id is not null
         order by lead_id, created_at desc
       ) latest where latest.verified_at is null) as drafted,
      (select count(*)::int from outreach
         where sent_at >= date_trunc('week', now()) and lead_id is not null) as sent,
      (select count(distinct lead_id)::int from events
         where type in ('reply','call','won')) as replied,
      (select round(avg(coalesce(s.model_score, s.pre_score)))::int
         from leads l join scores s on s.lead_id = l.id
         where l.status in ('needs_scoring','scored','needs_draft')) as score_avg,
      (select max(last_run_at) from sources) as last_run_at
  `);

  const r = rows.rows[0] as {
    harvested: number;
    drafted: number;
    sent: number;
    replied: number;
    score_avg: number | null;
    last_run_at: string | Date | null;
  };

  return {
    harvested: r.harvested ?? 0,
    drafted: r.drafted ?? 0,
    sent: r.sent ?? 0,
    replied: r.replied ?? 0,
    scoreAvg: r.score_avg,
    lastRunAt: r.last_run_at ? new Date(r.last_run_at) : null,
  };
}
