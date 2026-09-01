"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { events, leads } from "@/lib/db/schema";

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
