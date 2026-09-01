import { desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../lib/db";
import { loadLocalEnv } from "../lib/env";
import { leads, scores } from "../lib/db/schema";

/**
 * Flags roles that scored well but do not look like engineering work.
 *
 * A "Senior Product Manager" reached the inbox at 67 on remote, contract,
 * $96-118/hour terms — every dimension the rubric weights was excellent, so it
 * passed on merit. The disqualifier now rejects it, but the class of mistake is
 * the point: a job title nobody thought to list is invisible until it scores
 * well enough to be seen.
 *
 * This is deliberately a report, not a filter. It cannot know whether an unusual
 * title is wrong, only that it is worth a human glance — and turning a hunch
 * into a rejection is how a filter starts discarding work quietly.
 */
const SUSPECT =
  /\b(manager|director|designer|analyst|marketing|sales|recruit\w*|coordinator|writer|producer|strategist|consultant|specialist|advocate|evangelist)\b/i;

const ENGINEERING =
  /\b(engineer|engineering|developer|dev|swe|programmer|architect|sre|devops|full[- ]?stack|backend|back[- ]end|frontend|front[- ]end|mobile|android|ios|founder)\b/i;

/** Below this a title is not worth attention: it is already far from the gate. */
const FLOOR = 50;

async function main() {
  loadLocalEnv();
  const db = getDb();

  const rows = await db
    .select({
      title: leads.title,
      company: leads.company,
      status: leads.status,
      score: sql<number>`coalesce(${scores.modelScore}, ${scores.preScore})`,
    })
    .from(leads)
    .innerJoin(scores, eq(scores.leadId, leads.id))
    .where(gte(sql`coalesce(${scores.modelScore}, ${scores.preScore})`, FLOOR))
    .orderBy(desc(sql`coalesce(${scores.modelScore}, ${scores.preScore})`));

  const flagged = rows.filter((r) => SUSPECT.test(r.title) && !ENGINEERING.test(r.title));

  for (const r of flagged) {
    console.log(`  ${r.score} [${r.status}] ${r.company} — ${r.title.slice(0, 60)}`);
  }

  console.log(
    `audit-titles: ${rows.length} lead(s) scoring ${FLOOR}+, ${flagged.length} worth a look`,
  );

  if (flagged.length) {
    console.log(
      "If any of those are genuinely not engineering work, add the word to NON_ENGINEERING\n" +
        "in lib/scoring/disqualify.ts — and add a test that an engineering title containing it\n" +
        "still passes, because that list is broad on purpose.",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
