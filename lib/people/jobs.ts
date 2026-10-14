import { and, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { getDb } from "../db";
import { companies, discoveryJobs, leads, prospects } from "../db/schema";
import { rootDomain } from "../places/normalize";
import { publicDomain } from "../places/public-institution";
import { discoverCompany } from "./discover";
import { createContext } from "./fetch";

/**
 * Where companies come from, and the jobs that discover them.
 *
 * Three ways in: the local businesses already found on the map that have a
 * website, the companies behind job leads (hiring is itself a signal), and a
 * domain typed in. A job is a list of company ids with a progress count that
 * the /people page polls. Its message holds counts only: it is printed in
 * public GitHub Actions logs.
 */
export const MAX_PER_JOB = 50;

const isPublic = (domain: string | null) => !!domain && !!publicDomain(`x@${domain}`);

/** Companies from the best-scored local businesses with a website, not yet added. */
export async function seedFromProspects(limit: number): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: prospects.id,
      name: prospects.name,
      website: prospects.website,
      category: prospects.category,
      city: prospects.city,
      countryCode: prospects.countryCode,
    })
    .from(prospects)
    .where(and(isNotNull(prospects.website), ne(prospects.status, "do_not_contact")))
    .orderBy(desc(prospects.score))
    .limit(limit * 4);

  const ids: string[] = [];
  for (const r of rows) {
    if (ids.length >= limit) break;
    const domain = rootDomain(r.website);
    if (!domain || isPublic(domain)) continue;
    const [row] = await db
      .insert(companies)
      .values({
        name: r.name,
        domain,
        industry: r.category,
        location: r.city,
        countryCode: r.countryCode,
        origin: "prospect",
        originId: r.id,
      })
      .onConflictDoNothing()
      .returning({ id: companies.id });
    if (row) ids.push(row.id);
  }
  return ids;
}

/** Companies behind recent job leads: they are hiring, which says they need people who build. */
export async function seedFromLeads(limit: number): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ id: leads.id, company: leads.company })
    .from(leads)
    .where(isNotNull(leads.company))
    .orderBy(desc(leads.harvestedAt))
    .limit(limit * 4);
  const seen = new Set(
    (await db.select({ name: companies.name }).from(companies).where(eq(companies.origin, "lead"))).map((c) =>
      c.name.toLowerCase(),
    ),
  );
  const ids: string[] = [];
  for (const r of rows) {
    if (ids.length >= limit) break;
    const name = r.company?.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const [row] = await db
      .insert(companies)
      .values({ name, domain: null, origin: "lead", originId: r.id, signals: { hiringDevelopers: true } })
      .returning({ id: companies.id });
    ids.push(row.id);
  }
  return ids;
}

/** A company typed in by domain. Returns the existing one when the domain is known. */
export async function addCompany(input: { domain: string; name?: string; countryCode?: string }): Promise<string> {
  const db = getDb();
  const domain = rootDomain(input.domain.includes("://") ? input.domain : `https://${input.domain}`);
  if (!domain) throw new Error("not a domain");
  if (isPublic(domain)) throw new Error(`${domain} is a public body, not a prospect`);
  const [row] = await db
    .insert(companies)
    .values({
      name: input.name?.trim() || domain.split(".")[0],
      domain,
      countryCode: input.countryCode?.toUpperCase() ?? null,
      origin: "manual",
    })
    .onConflictDoNothing()
    .returning({ id: companies.id });
  if (row) return row.id;
  const [found] = await db.select({ id: companies.id }).from(companies).where(eq(companies.domain, domain)).limit(1);
  return found.id;
}

export async function createJob(companyIds: string[]): Promise<string> {
  const ids = companyIds.slice(0, MAX_PER_JOB);
  const [row] = await getDb()
    .insert(discoveryJobs)
    .values({ kind: "companies", input: { companyIds: ids }, total: ids.length })
    .returning({ id: discoveryJobs.id });
  return row.id;
}

export async function recentJobs(limit = 5) {
  return getDb().select().from(discoveryJobs).orderBy(desc(discoveryJobs.createdAt)).limit(limit);
}

/** Runs one job, counting progress as it goes. A company that fails is counted and passed. */
export async function runJob(jobId: string): Promise<void> {
  const db = getDb();
  const [job] = await db.select().from(discoveryJobs).where(eq(discoveryJobs.id, jobId)).limit(1);
  if (!job || job.status === "done") return;
  const ids = job.input.companyIds;
  await db
    .update(discoveryJobs)
    .set({ status: "running", startedAt: new Date(), total: ids.length, progress: 0 })
    .where(eq(discoveryJobs.id, jobId));

  const ctx = createContext();
  let found = 0;
  let skipped = 0;
  let failed = 0;
  for (const [i, id] of ids.entries()) {
    try {
      const result = await discoverCompany(id, { ctx });
      if (result.status === "skipped") skipped++;
      found += result.people;
    } catch {
      failed++;
    }
    await db
      .update(discoveryJobs)
      .set({
        progress: i + 1,
        message: `${i + 1} of ${ids.length} companies · ${found} decision-makers found` +
          (skipped ? ` · ${skipped} skipped` : "") +
          (failed ? ` · ${failed} failed` : ""),
      })
      .where(eq(discoveryJobs.id, jobId));
  }
  await db
    .update(discoveryJobs)
    .set({ status: failed === ids.length && ids.length > 0 ? "failed" : "done", finishedAt: new Date() })
    .where(eq(discoveryJobs.id, jobId));
}

/** Every queued job, oldest first: what "Run queued" and the terminal fallback drain. */
export async function queuedJobIds(): Promise<string[]> {
  const rows = await getDb()
    .select({ id: discoveryJobs.id })
    .from(discoveryJobs)
    .where(inArray(discoveryJobs.status, ["queued"]))
    .orderBy(sql`${discoveryJobs.createdAt} asc`);
  return rows.map((r) => r.id);
}
