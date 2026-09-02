import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { getDb } from "../lib/db";
import { loadLocalEnv } from "../lib/env";
import { events, leads, outreach } from "../lib/db/schema";
import { DraftBatch, readValidatedStdin } from "../lib/model/schemas";

/**
 * Persists drafts. `verifiedAt` is deliberately left null — nothing here may set
 * it, because a draft that verified itself has not been verified.
 */
async function main() {
  loadLocalEnv();
  const db = getDb();
  const { drafts } = await readValidatedStdin(DraftBatch);

  const awaiting = await db
    .select({ id: leads.id })
    .from(leads)
    .where(eq(leads.status, "needs_draft"));
  const allowed = new Set(awaiting.map((r) => r.id));

  // A lead whose latest draft failed verification is already at "drafted", so
  // it would be refused here — which made the single retry the verifier is
  // built around impossible to actually apply. A draft still carrying no
  // `verifiedAt` is one nothing has accepted, so a rewrite is welcome.
  const retryable = await db
    .select({ id: outreach.leadId })
    .from(outreach)
    // Scoped to job rows: prospect messages share this table and have no lead.
    .where(and(isNull(outreach.verifiedAt), isNotNull(outreach.leadId)));
  for (const row of retryable) if (row.id) allowed.add(row.id);

  const unknown = drafts.filter((d) => !allowed.has(d.leadId));
  if (unknown.length) {
    console.error(`${unknown.length} draft(s) reference leads not awaiting a draft`);
    process.exit(1);
  }

  await db.insert(outreach).values(
    drafts.map((d) => ({
      leadId: d.leadId,
      step: 0,
      subject: d.subject,
      body: d.body,
      angle: d.angle,
      proofUsed: d.proofUsed,
      verifiedAt: null,
    })),
  );

  await db.insert(events).values(
    drafts.map((d) => ({
      leadId: d.leadId,
      type: "draft_written",
      meta: { angle: d.angle, proofUsed: d.proofUsed },
    })),
  );

  await db
    .update(leads)
    .set({ status: "drafted" })
    .where(inArray(leads.id, drafts.map((d) => d.leadId)));

  console.log(`apply-drafts: wrote ${drafts.length} draft(s), all unverified`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
