import { eq } from "drizzle-orm";
import { getDb } from "../lib/db";
import { companies, people } from "../lib/db/schema";
import { loadLocalEnv } from "../lib/env";
import { cleanTitle, looksLikeName } from "../lib/people/providers/website";
import { scorePerson } from "../lib/people/score";
import { isDecisionMaker, seniorityOf } from "../lib/people/seniority";

/**
 * Applies today's rules to people found before them:
 *
 *   pnpm people:tidy [--dry]
 *
 * A row whose name no longer passes as a person's ("Quality Materials"), or
 * whose title is not a buyer's ("Director of First Impressions"), is removed;
 * a title that was a sentence or carried a licence number is tidied, and the
 * person banded and scored again. Only people still New are removed: anyone
 * already written to keeps their row. Discovery adds and updates people but
 * never takes one away, so without this a rule only ever reached new finds.
 */
async function main() {
  loadLocalEnv();
  const dry = process.argv.includes("--dry");
  const db = getDb();
  const rows = await db.select({ p: people, c: companies }).from(people).innerJoin(companies, eq(companies.id, people.companyId));

  let removed = 0;
  let kept = 0;
  let tidied = 0;
  for (const { p, c } of rows) {
    const title = p.title ? cleanTitle(p.title) : "";
    if (!looksLikeName(p.name) || !title || !isDecisionMaker(title)) {
      if (p.status !== "new") {
        kept += 1;
        continue;
      }
      if (!dry) await db.delete(people).where(eq(people.id, p.id));
      removed += 1;
      continue;
    }
    if (title === p.title) continue;
    const seniority = seniorityOf(title);
    const { score, reasons } = scorePerson({ ...p, title, seniority } as never, c as never);
    if (!dry) {
      await db
        .update(people)
        .set({ title, seniority, score, scoreReasons: reasons, updatedAt: new Date() })
        .where(eq(people.id, p.id));
    }
    tidied += 1;
  }

  console.log(
    `people:tidy${dry ? " (dry run)" : ""}: ${rows.length} people — ${removed} removed, ${tidied} titles tidied` +
      (kept ? `, ${kept} kept because they were already written to` : ""),
  );
}

main().catch((err) => {
  console.error("people:tidy:", err instanceof Error ? err.message : err);
  process.exit(1);
});
