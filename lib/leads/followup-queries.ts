import { desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "../db";
import { events, leads, outreach } from "../db/schema";
import { MAX_STEP, REPLIED_TYPES, isDue } from "../followups";

export interface FollowupRow {
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

  if (!sent.length) return [];

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

  return due.sort((a, b) => b.daysSince - a.daysSince);
}
