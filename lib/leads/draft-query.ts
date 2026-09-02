import { desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { events, outreach } from "../db/schema";
import type { Violation } from "../model/schemas";

export interface DraftView {
  id: string;
  subject: string;
  body: string;
  angle: string | null;
  proofUsed: string[] | null;
  verifiedAt: Date | null;
  gmailDraftId: string | null;
  sentAt: Date | null;
  violations: Violation[];
}

/**
 * The newest draft for a lead, with whatever the verifier said about it.
 *
 * Violations live in the events table rather than on the outreach row: a draft
 * can be verified more than once, and the failures are the record of why it was
 * rewritten. Only the most recent verdict is shown — older ones describe text
 * that no longer exists.
 */
export async function getDraft(leadId: string): Promise<DraftView | null> {
  const db = getDb();

  const [row] = await db
    .select()
    .from(outreach)
    .where(eq(outreach.leadId, leadId))
    .orderBy(desc(outreach.createdAt))
    .limit(1);

  if (!row) return null;

  // Only a verify_failed event carries violations, and only the most recent
  // verdict counts — older ones describe text that no longer exists.
  const all = await db
    .select({ type: events.type, meta: events.meta })
    .from(events)
    .where(eq(events.leadId, leadId))
    .orderBy(desc(events.createdAt))
    .limit(20);

  const latestVerdict = all.find((e) => e.type === "verify_failed" || e.type === "verify_passed");
  const violations =
    latestVerdict?.type === "verify_failed"
      ? (((latestVerdict.meta as { violations?: Violation[] } | null)?.violations ?? []) as Violation[])
      : [];

  return {
    id: row.id,
    subject: row.subject,
    body: row.body,
    angle: row.angle,
    proofUsed: row.proofUsed,
    verifiedAt: row.verifiedAt,
    gmailDraftId: row.gmailDraftId,
    sentAt: row.sentAt,
    violations,
  };
}
