"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { events, leads, outreach } from "@/lib/db/schema";

/**
 * Triage is one keystroke, so every one of these writes an event row. The Phase
 * 6 learning loop needs to know what was rejected by hand and why, not just what
 * survived — and a status column alone cannot answer that after the fact.
 */
type TriageStatus = "parked" | "disqualified" | "needs_draft";

export async function setLeadStatus(id: string, status: TriageStatus, reason?: string) {
  const db = getDb();
  await db.update(leads).set({ status }).where(eq(leads.id, id));
  await db.insert(events).values({
    leadId: id,
    type: "status_change",
    meta: { status, reason: reason ?? null, by: "triage" },
  });
  revalidatePath("/");
}

/**
 * Outcome logging — the raw material for the learning loop.
 *
 * `sent` is recorded by hand because this system never sends: Joshua presses
 * send in Gmail, and the timestamp has to come from him. Everything downstream
 * measures from it, so a guessed value would quietly corrupt every reply rate.
 */
export type Outcome = "sent" | "no_reply" | "reply" | "call" | "won" | "lost";

const STATUS_FOR: Partial<Record<Outcome, "answered" | "won" | "lost" | "closed">> = {
  reply: "answered",
  call: "answered",
  won: "won",
  lost: "lost",
  no_reply: "closed",
};

export async function logOutcome(leadId: string, outcome: Outcome) {
  const db = getDb();

  if (outcome === "sent") {
    // Stamps the most recent draft for this lead. The follow-up ladder measures
    // from the last touch, so this is what starts the clock.
    const [latest] = await db
      .select({ id: outreach.id })
      .from(outreach)
      .where(eq(outreach.leadId, leadId))
      .orderBy(desc(outreach.createdAt))
      .limit(1);

    if (latest) {
      await db.update(outreach).set({ sentAt: new Date() }).where(eq(outreach.id, latest.id));
    }
  }

  const status = STATUS_FOR[outcome];
  if (status) {
    await db.update(leads).set({ status }).where(eq(leads.id, leadId));
  }

  await db.insert(events).values({ leadId, type: outcome, meta: { by: "human" } });

  revalidatePath("/");
  revalidatePath(`/lead/${leadId}`);
  revalidatePath("/review");
  revalidatePath("/followups");
}
