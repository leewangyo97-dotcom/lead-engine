import { desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { leads, scores } from "../db/schema";

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
      score: sql<number | null>`coalesce(${scores.modelScore}, ${scores.preScore})`,
      tier: scores.tier,
    })
    .from(leads)
    .leftJoin(scores, eq(scores.leadId, leads.id))
    .where(inArray(leads.status, [...TRIAGE_STATUSES]))
    .orderBy(desc(sql`coalesce(${scores.modelScore}, ${scores.preScore})`), desc(leads.harvestedAt));

  return rows as InboxRow[];
}

export async function getLead(id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(leads)
    .leftJoin(scores, eq(scores.leadId, leads.id))
    .where(eq(leads.id, id))
    .limit(1);
  return row ?? null;
}

export function tierOf(score: number | null): "live" | "warn" | "cold" {
  if (score == null) return "cold";
  return score >= 75 ? "live" : score >= 60 ? "warn" : "cold";
}
