import { and, eq, isNotNull, sql } from "drizzle-orm";
import pMap from "p-map";
import { getDb } from "../lib/db";
import { prospects } from "../lib/db/schema";
import { loadLocalEnv } from "../lib/env";
import { isPersonalEmail } from "../lib/people/email-pattern";
import { checkMailDomain, domainOfEmail, workingResolver } from "../lib/places/email-mx";

/**
 * Asks DNS whether each prospect email's domain has a mail server, and stores
 * the answer on the prospect (`email_check`). Only addresses never checked, or
 * changed since, are looked at, so the nightly run touches the new ones.
 *
 *   pnpm email:mx [--limit=N]
 *
 * Each domain is asked once per run, sixteen at a time. Free-mail domains
 * (gmail.com and the like) are known to take mail and are not asked. A lookup
 * that fails to answer (a timeout, a server error) stores nothing, so the next
 * run asks again. Output is counts only: the nightly log is public.
 */
async function main() {
  loadLocalEnv();
  const limit = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 5000);
  const db = getDb();

  const rows = (
    await db
      .select({ id: prospects.id, email: prospects.email, emailCheck: prospects.emailCheck })
      .from(prospects)
      .where(isNotNull(prospects.email))
  ).filter((r) => {
    const domain = domainOfEmail(r.email);
    return domain && r.emailCheck?.domain !== domain;
  });

  const byDomain = new Map<string, string[]>();
  for (const r of rows) {
    const domain = domainOfEmail(r.email);
    if (!byDomain.has(domain) && byDomain.size >= limit) continue;
    byDomain.set(domain, [...(byDomain.get(domain) ?? []), r.id]);
  }

  const resolver = await workingResolver();
  const at = new Date().toISOString();
  const tally = { ok: 0, dead: 0, unknown: 0 };
  await pMap(
    [...byDomain.entries()],
    async ([domain, ids]) => {
      const answer = isPersonalEmail(`x@${domain}`) ? "ok" : await checkMailDomain(domain, resolver);
      tally[answer] += 1;
      if (answer === "unknown") return;
      const check = { domain, mx: answer === "ok", at };
      for (const id of ids) {
        await db
          .update(prospects)
          .set({ emailCheck: check })
          .where(and(eq(prospects.id, id), sql`${prospects.email} is not null`));
      }
    },
    { concurrency: 16 },
  );

  console.log(
    `email:mx: ${byDomain.size} domains checked for ${rows.length} addresses — ` +
      `${tally.ok} take mail, ${tally.dead} have no mail server, ${tally.unknown} did not answer`,
  );
}

main().catch((err) => {
  console.error("email:mx:", err instanceof Error ? err.message : err);
  process.exit(1);
});
