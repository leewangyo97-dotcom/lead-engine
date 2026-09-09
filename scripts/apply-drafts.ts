import { readFileSync } from "node:fs";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { getDb } from "../lib/db";
import { loadLocalEnv } from "../lib/env";
import { events, leads, outreach } from "../lib/db/schema";
import { DraftBatch, readValidatedStdin } from "../lib/model/schemas";
import { verifyClaims, verifyLocation } from "../lib/model/profile-claims";
import { addRunCounts } from "../lib/leads/run-metrics";
import { checkStep } from "../lib/leads/draft-step";

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

  // A follow-up is written for a lead that was already contacted, so it sits at
  // `in_gmail` rather than `needs_draft`. Those are allowed in on the strength of
  // the step check below, which is stricter than a status test: it knows which
  // rung is next and refuses anything else.
  for (const draft of drafts) if ((draft.step ?? 0) > 0) allowed.add(draft.leadId);

  const unknown = drafts.filter((d) => !allowed.has(d.leadId));
  if (unknown.length) {
    console.error(`${unknown.length} draft(s) reference leads not awaiting a draft`);
    process.exit(1);
  }

  // Which rung each draft claims, checked against what has actually been sent.
  const existing = await db
    .select({ leadId: outreach.leadId, step: outreach.step, sentAt: outreach.sentAt })
    .from(outreach)
    .where(and(isNotNull(outreach.leadId), inArray(outreach.leadId, drafts.map((d) => d.leadId))));

  const misstepped = drafts
    .map((draft) => {
      const rows = existing.filter((r) => r.leadId === draft.leadId);
      const sent = rows.filter((r) => r.sentAt !== null).map((r) => r.step);
      const step = draft.step ?? 0;
      const check = checkStep({
        step,
        highestSentStep: sent.length ? Math.max(...sent) : null,
        hasUnsentDraft: rows.some((r) => r.step === step && r.sentAt === null),
      });
      return { draft, check };
    })
    .filter((r) => !r.check.ok);

  if (misstepped.length) {
    for (const { draft, check } of misstepped) {
      console.error(`${draft.leadId}: ${check.reason}`);
    }
    process.exit(1);
  }

  // Every figure quoted about Joshua has to appear in PROFILE.md. The model
  // verifier judges the prose; this refuses the one error that does concrete
  // damage — an invented or inflated metric in an email to a stranger.
  const profile = readFileSync("memory/PROFILE.md", "utf8");
  const invented = drafts.flatMap((d) => {
    const text = `${d.subject} ${d.body}`;
    return [...verifyClaims(text, profile), ...verifyLocation(text, profile)].map((v) => ({ d, v }));
  });
  if (invented.length) {
    for (const { d, v } of invented) {
      console.error(`${d.leadId}: "${v.quote}" — ${v.reason}`);
    }
    process.exit(1);
  }

  await db.insert(outreach).values(
    drafts.map((d) => ({
      leadId: d.leadId,
      step: d.step ?? 0,
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

  await addRunCounts({ drafted: drafts.length });

  console.log(`apply-drafts: wrote ${drafts.length} draft(s), all unverified`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
