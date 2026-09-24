import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { getDb } from "../lib/db";
import { loadLocalEnv } from "../lib/env";
import { events, outreach } from "../lib/db/schema";
import { VerdictBatch, readValidatedStdin } from "../lib/model/schemas";

/**
 * The only place `verifiedAt` is ever set. Everything about the Gmail path keys
 * off that column, so it has exactly one writer and that writer takes its input
 * from the verifier and nowhere else.
 *
 * Failures are recorded rather than discarded: the violation text is what the
 * copywriter gets on its single retry, and what a human reads if that retry also
 * fails.
 */
async function main() {
  loadLocalEnv();
  const db = getDb();
  const { verdicts } = await readValidatedStdin(VerdictBatch);

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const verdict of verdicts) {
    // The most recent *unsent* draft for this lead — a retry writes a second
    // outreach row, and the verdict applies to the newer one. The comment here
    // always said "unverified", and `isNull` was imported for it, but the query
    // filtered on nothing: a verdict could land on an email already sent.
    const [row] = await db
      .select({ id: outreach.id, createdAt: outreach.createdAt })
      .from(outreach)
      .where(and(eq(outreach.leadId, verdict.leadId), isNull(outreach.sentAt)))
      .orderBy(desc(outreach.createdAt))
      .limit(1);

    if (!row) {
      console.error(`no draft found for lead ${verdict.leadId}`);
      process.exit(1);
    }

    // One verdict per draft. Re-running the same payload — which happened on
    // 24 Sept, after a `tail` hid the first run's success line — wrote every
    // verify event twice and re-stamped `verifiedAt`. A verdict newer than the
    // draft means this draft has been judged; a revision is a new row, newer
    // than that verdict, so it is still judged in its turn.
    const [judged] = await db
      .select({ id: events.id })
      .from(events)
      .where(
        and(
          eq(events.leadId, verdict.leadId),
          inArray(events.type, ["verify_passed", "verify_failed"]),
          gt(events.createdAt, row.createdAt),
        ),
      )
      .limit(1);
    if (judged) {
      console.log(`  ${verdict.leadId}: this draft already has a verdict — skipped`);
      skipped += 1;
      continue;
    }

    if (verdict.ok) {
      await db.update(outreach).set({ verifiedAt: new Date() }).where(eq(outreach.id, row.id));
      passed += 1;
    } else {
      failed += 1;
    }

    await db.insert(events).values({
      leadId: verdict.leadId,
      type: verdict.ok ? "verify_passed" : "verify_failed",
      meta: { violations: verdict.violations },
    });
  }

  console.log(`apply-verdicts: passed=${passed} failed=${failed} skipped=${skipped}`);

  if (failed) {
    for (const v of verdicts.filter((x) => !x.ok)) {
      for (const violation of v.violations) {
        console.log(`  ${v.leadId} [${violation.type}] "${violation.quote}"`);
        console.log(`    fix: ${violation.fix}`);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
