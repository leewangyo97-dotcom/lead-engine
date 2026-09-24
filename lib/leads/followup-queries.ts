import { and, desc, eq, gt, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { getDb } from "../db";
import { events, leads, outreach, prospects } from "../db/schema";
import { MAX_STEP, REPLIED_TYPES, isDue } from "../followups";

export interface FollowupRow {
  /** Which side of the funnel this came from, so the row can link somewhere. */
  kind: "lead" | "prospect";
  leadId: string;
  company: string;
  title: string;
  contact: string | null;
  nextStep: number;
  lastSentAt: Date;
  previousSubject: string;
  previousAngle: string | null;
  daysSince: number;
  /**
   * An unsent draft already written for `nextStep`, if any. The rung is still
   * owed — nothing has gone out — but writing it again is waste, and the page
   * must not read "due now" to someone whose draft is sitting in Gmail.
   */
  pendingDraft: "in_gmail" | "drafted" | null;
}

/**
 * Everything sent, unanswered, and past its next rung.
 *
 * Computed rather than stored: a `dueAt` column would need rewriting every time
 * an outcome is logged, and a stale one would queue a follow-up to someone who
 * already replied. Deriving it means a reply cancels the ladder by existing.
 */
/**
 * The follow-ups a model still has to write.
 *
 * `getDueFollowups` answers for both funnels, which is right for the page: a
 * person working Monday wants one list. The `/daily-run` payload is a different
 * question, and feeding it both was a bug waiting for 13 September — sixteen of
 * the eighteen due are prospects, and `apply:drafts` allows any id carrying a
 * step through its "awaiting a draft" check, so a prospect id would have reached
 * the insert and died on the lead foreign key.
 *
 * Prospect follow-ups are written by `followUpMessage` from the trade and the
 * step, with no model involved, so there is nothing for the copywriter to do
 * with them.
 */
export function forLeadDrafting(rows: readonly FollowupRow[]): FollowupRow[] {
  // Minus any whose draft already exists: on 24 Sept `pnpm followups` still
  // asked for Atria and This Dot Labs step 1 with both drafts waiting in Gmail,
  // so the next run would have paid to write them twice.
  return rows.filter((r) => r.kind === "lead" && !r.pendingDraft);
}

export async function getDueFollowups(now = new Date()): Promise<FollowupRow[]> {
  const db = getDb();

  const sent = await db
    .select({
      // The inner join to leads guarantees this is present; outreach.leadId is
      // nullable only because a row may instead belong to a geo prospect.
      leadId: sql<string>`${outreach.leadId}`,
      step: outreach.step,
      sentAt: outreach.sentAt,
      subject: outreach.subject,
      angle: outreach.angle,
      company: leads.company,
      title: leads.title,
      contact: leads.contact,
    })
    .from(outreach)
    .innerJoin(leads, eq(leads.id, outreach.leadId))
    .where(isNotNull(outreach.sentAt))
    .orderBy(desc(outreach.sentAt));

  // No early return on an empty lead set: prospects have their own ladder below,
  // and returning here would silently skip every one of them.
  const replies = await db
    .select({ leadId: events.leadId })
    .from(events)
    .where(inArray(events.type, [...REPLIED_TYPES]));
  const answered = new Set(replies.map((r) => r.leadId).filter(Boolean) as string[]);

  // Rows arrive newest-first, so the first entry per lead is its latest touch.
  const latest = new Map<string, (typeof sent)[number]>();
  const highestStep = new Map<string, number>();
  for (const row of sent) {
    if (!latest.has(row.leadId)) latest.set(row.leadId, row);
    highestStep.set(row.leadId, Math.max(highestStep.get(row.leadId) ?? 0, row.step));
  }

  // Follow-up drafts written but not sent, by lead and rung.
  const drafts = await db
    .select({
      leadId: sql<string>`${outreach.leadId}`,
      step: outreach.step,
      inGmail: sql<boolean>`${outreach.gmailDraftId} is not null`,
    })
    .from(outreach)
    .where(and(isNotNull(outreach.leadId), isNull(outreach.sentAt), gt(outreach.step, 0)));
  const pending = new Map<string, "in_gmail" | "drafted">();
  for (const d of drafts) {
    const key = `${d.leadId}:${d.step}`;
    if (d.inGmail) pending.set(key, "in_gmail");
    else if (!pending.has(key)) pending.set(key, "drafted");
  }

  const due: FollowupRow[] = [];
  for (const [leadId, row] of latest) {
    const nextStep = (highestStep.get(leadId) ?? 0) + 1;
    if (nextStep > MAX_STEP) continue;

    if (!isDue({ lastSentAt: row.sentAt, nextStep, hasReplied: answered.has(leadId), now })) {
      continue;
    }

    due.push({
      kind: "lead",
      leadId,
      company: row.company,
      title: row.title,
      contact: row.contact,
      nextStep,
      lastSentAt: row.sentAt!,
      previousSubject: row.subject,
      previousAngle: row.angle,
      daysSince: Math.floor((now.getTime() - row.sentAt!.getTime()) / 86_400_000),
      pendingDraft: pending.get(`${leadId}:${nextStep}`) ?? null,
    });
  }

  const all = [...due, ...(await prospectFollowups(now))];
  return all.sort((a, b) => b.daysSince - a.daysSince);
}

/**
 * The same ladder, for businesses messaged over WhatsApp.
 *
 * They were left out when follow-ups were built, so a message sent from the
 * prospects table was the end of the conversation whatever happened next. The
 * reply signal differs: prospects have no events, so their own status is what
 * says they answered.
 */
async function prospectFollowups(now: Date): Promise<FollowupRow[]> {
  const db = getDb();

  const sent = await db
    .select({
      prospectId: sql<string>`${outreach.prospectId}`,
      step: outreach.step,
      sentAt: outreach.sentAt,
      subject: outreach.subject,
      angle: outreach.angle,
      name: prospects.name,
      category: prospects.category,
      email: prospects.email,
      phone: prospects.phoneE164,
      status: prospects.status,
    })
    .from(outreach)
    .innerJoin(prospects, eq(prospects.id, outreach.prospectId))
    .where(isNotNull(outreach.sentAt))
    .orderBy(desc(outreach.sentAt));

  const latest = new Map<string, (typeof sent)[number]>();
  const highestStep = new Map<string, number>();
  for (const row of sent) {
    if (!latest.has(row.prospectId)) latest.set(row.prospectId, row);
    highestStep.set(row.prospectId, Math.max(highestStep.get(row.prospectId) ?? 0, row.step));
  }

  const due: FollowupRow[] = [];
  for (const [prospectId, row] of latest) {
    const nextStep = (highestStep.get(prospectId) ?? 0) + 1;
    if (nextStep > MAX_STEP) continue;

    // A prospect who replied, closed or asked not to be contacted is answered.
    // Chasing any of those is the failure this check exists to prevent.
    const hasReplied = isAnsweredProspectStatus(row.status);
    if (!isDue({ lastSentAt: row.sentAt, nextStep, hasReplied, now })) continue;

    due.push({
      kind: "prospect",
      leadId: prospectId,
      company: row.name,
      title: row.category,
      contact: row.email ?? row.phone,
      nextStep,
      lastSentAt: row.sentAt!,
      previousSubject: row.subject,
      previousAngle: row.angle,
      daysSince: Math.floor((now.getTime() - row.sentAt!.getTime()) / 86_400_000),
      // Prospect follow-ups are written by the app on the click, never drafted
      // ahead, so there is nothing pending to find.
      pendingDraft: null,
    });
  }

  return due;
}

const ANSWERED_PROSPECT_STATUS = new Set(["replied", "won", "lost", "do_not_contact"]);

/**
 * Whether a prospect's own status already counts as an answer.
 *
 * Prospects have no events table behind them, so status is the only reply
 * signal there is. Chasing someone who declined is the failure this prevents,
 * which is why it is a named rule rather than an inline set membership.
 */
export function isAnsweredProspectStatus(status: string): boolean {
  return ANSWERED_PROSPECT_STATUS.has(status);
}

/**
 * How many follow-ups are owed, without building any of them.
 *
 * `getDueFollowups` assembles a row per lead and per prospect across three
 * queries, which is right for the page that lists them and absurd for a badge
 * in the sidebar — it cost about 180ms on every page in the app. This asks the
 * database for the only four facts the ladder needs per conversation, in one
 * query, and applies the same `isDue` rule so there is still one definition of
 * "owed".
 */
export async function countDueFollowups(now = new Date()): Promise<number> {
  const db = getDb();

  const rows = await db.execute(sql`
    select
      max(o.step) as highest_step,
      max(o.sent_at) as last_sent,
      bool_or(
        coalesce(l.status in ('answered', 'won', 'lost', 'closed'), false)
        or coalesce(p.status in ('replied', 'won', 'lost', 'do_not_contact'), false)
        or exists (
          select 1 from events e
          where e.lead_id = o.lead_id and e.type in ('reply', 'call', 'won', 'lost')
        )
      ) as answered
    from outreach o
    left join leads l on l.id = o.lead_id
    left join prospects p on p.id = o.prospect_id
    where o.sent_at is not null
    group by coalesce(o.lead_id, o.prospect_id)
  `);

  const conversations = rows.rows as unknown as {
    highest_step: number;
    last_sent: string | Date | null;
    answered: boolean;
  }[];

  return conversations.filter((row) =>
    isDue({
      lastSentAt: row.last_sent ? new Date(row.last_sent) : null,
      nextStep: (row.highest_step ?? 0) + 1,
      hasReplied: row.answered,
      now,
    }),
  ).length;
}