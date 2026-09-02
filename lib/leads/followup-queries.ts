import { desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
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
}

/**
 * Everything sent, unanswered, and past its next rung.
 *
 * Computed rather than stored: a `dueAt` column would need rewriting every time
 * an outcome is logged, and a stale one would queue a follow-up to someone who
 * already replied. Deriving it means a reply cancels the ladder by existing.
 */
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
