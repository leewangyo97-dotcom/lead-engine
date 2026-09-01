import { desc, eq, isNull } from "drizzle-orm";
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

  for (const verdict of verdicts) {
    // The most recent unverified draft for this lead — a retry writes a second
    // outreach row, and the verdict applies to the newer one.
    const [row] = await db
      .select({ id: outreach.id })
      .from(outreach)
      .where(eq(outreach.leadId, verdict.leadId))
      .orderBy(desc(outreach.createdAt))
      .limit(1);

    if (!row) {
      console.error(`no draft found for lead ${verdict.leadId}`);
      process.exit(1);
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

  console.log(`apply-verdicts: passed=${passed} failed=${failed}`);

  if (failed) {
    for (const v of verdicts.filter((x) => !x.ok)) {
      console.log(`  ${v.leadId}: ${v.violations.join("; ")}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
