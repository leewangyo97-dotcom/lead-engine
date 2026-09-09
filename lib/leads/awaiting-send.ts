import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { leads, outreach } from "../db/schema";

/**
 * Drafts sitting in Gmail that nobody has sent.
 *
 * The app never mentioned these. A draft is created, the lead moves to
 * `in_gmail`, and from that moment the only way to know it exists is to open
 * Gmail — so the This Dot Labs application sat unsent for a week while every
 * screen in the app reported nothing outstanding.
 *
 * This is the one queue with a deadline attached. A job posting goes cold: the
 * role is filled, the thread is buried, and an application sent three weeks late
 * reads as an application nobody cared to send on time.
 */

/** A draft older than this is worth flagging rather than merely listing. */
export const STALE_DRAFT_DAYS = 5;

/** Past this the posting is likely closed and the draft is not worth sending. */
export const COLD_DRAFT_DAYS = 21;

export type DraftAge = "fresh" | "stale" | "cold";

export interface AwaitingSend {
  leadId: string;
  company: string;
  title: string;
  contact: string | null;
  subject: string;
  createdAt: Date;
  ageDays: number;
  age: DraftAge;
}

export function ageOf(days: number): DraftAge {
  if (days >= COLD_DRAFT_DAYS) return "cold";
  if (days >= STALE_DRAFT_DAYS) return "stale";
  return "fresh";
}

export async function getAwaitingSend(now = new Date()): Promise<AwaitingSend[]> {
  const db = getDb();

  const rows = await db
    .select({
      leadId: leads.id,
      company: leads.company,
      title: leads.title,
      contact: leads.contact,
      subject: outreach.subject,
      createdAt: outreach.createdAt,
    })
    .from(outreach)
    .innerJoin(leads, eq(leads.id, outreach.leadId))
    // A Gmail draft that exists and has not been marked sent. `sentAt` is set by
    // hand, which is the only honest signal available — nothing here can see
    // what left the mailbox.
    .where(
      and(
        isNotNull(outreach.gmailDraftId),
        isNull(outreach.sentAt),
        isNotNull(outreach.verifiedAt),
      ),
    )
    .orderBy(asc(outreach.createdAt));

  return rows.map((row) => {
    const ageDays = Math.floor((now.getTime() - row.createdAt.getTime()) / 86_400_000);
    return { ...row, ageDays, age: ageOf(ageDays) };
  });
}
