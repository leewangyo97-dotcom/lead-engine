import { and, eq, isNotNull, or } from "drizzle-orm";
import { getDb } from "../lib/db";
import { loadLocalEnv } from "../lib/env";
import { prospects } from "../lib/db/schema";
import { buildEnhancePrompt } from "../lib/places/enhance";

/**
 * Prints the prompt for rewriting first messages.
 *
 *   pnpm prospects:enhance [searchId] [limit] | clip
 *
 * Paste the output into Claude Code, then feed the JSON back through
 * `pnpm apply:enhance`. No model is called from here — that is the same split
 * the scoring and drafting steps use.
 */
async function main() {
  loadLocalEnv();
  const db = getDb();

  const args = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const searchId = args[0];
  const limit = args[1] ? Number(args[1]) : 10;

  // Only prospects worth writing to, and the filter belongs in SQL: applying it
  // after LIMIT would silently return fewer than asked, or none at all.
  const reachable = and(
    eq(prospects.status, "new"),
    or(isNotNull(prospects.phoneE164), isNotNull(prospects.email)),
  );

  const candidates = await db
    .select()
    .from(prospects)
    .where(searchId ? and(eq(prospects.searchId, searchId), reachable) : reachable)
    .limit(limit);

  if (candidates.length === 0) {
    console.error("prospects:enhance: nothing to enhance — no reachable prospects");
    process.exit(1);
  }

  console.log(buildEnhancePrompt(candidates));
}

main().catch((err) => {
  console.error("prospects:enhance:", err instanceof Error ? err.message : err);
  process.exit(1);
});
