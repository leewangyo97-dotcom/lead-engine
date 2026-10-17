import { and, asc, count, desc, eq, gte, ilike, inArray, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "../db";
import { companies, people, peopleSources, prospects, suppressions } from "../db/schema";
import type { Seniority } from "./seniority";
import { isStatus } from "./status";

export { STATUSES, STATUS_LABEL, type PersonStatus } from "./status";

/**
 * What /people reads: the filtered, sorted, paged table, one person's detail
 * with the source of every field, and the export.
 */
export const PAGE_SIZE = 50;
export const SIZE_BANDS = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;

export interface PeopleFilter {
  q?: string;
  seniority?: Seniority[];
  industry?: string;
  /** ISO country code, from the Country chips. */
  country?: string;
  /** An exact industry, from the Category chips; `industry` is the typed, partial one. */
  category?: string;
  /** Everyone at one company: the "+N more" link of the one-per-business view. */
  company?: string;
  /**
   * One row per business, its best person (the default), rather than everyone:
   * Beckett Electrical's eight people read as the same row eight times (17 Oct).
   */
  perBusiness?: boolean;
  size?: string;
  location?: string;
  verified?: boolean;
  scoreMin?: number;
  scoreMax?: number;
  status?: string;
  sort?: "score" | "name" | "company" | "added";
  dir?: "asc" | "desc";
  page?: number;
}

/** Reads the filter from a page's search params, ignoring anything malformed. */
export function parseFilter(params: Record<string, string | string[] | undefined>): PeopleFilter {
  const one = (k: string) => (Array.isArray(params[k]) ? params[k]![0] : (params[k] as string | undefined))?.trim() || undefined;
  const num = (k: string) => {
    const n = Number(one(k));
    return Number.isFinite(n) && one(k) !== undefined ? n : undefined;
  };
  const seniority = ([] as string[])
    .concat(params.seniority ?? [])
    .filter((s): s is Seniority => ["c_level", "founder_owner", "vp", "director"].includes(s));
  const sort = one("sort");
  return {
    q: one("q"),
    seniority: seniority.length ? seniority : undefined,
    industry: one("industry"),
    country: /^[A-Za-z]{2}$/.test(one("country") ?? "") ? one("country")!.toUpperCase() : undefined,
    category: one("category"),
    company: one("company"),
    // On unless asked for everyone, and never when looking at one company.
    perBusiness: one("all") !== "1" && !one("company"),
    size: SIZE_BANDS.includes(one("size") as never) ? one("size") : undefined,
    location: one("location"),
    verified: one("verified") === "1",
    scoreMin: num("scoreMin"),
    scoreMax: num("scoreMax"),
    status: isStatus(one("status")) ? one("status") : undefined,
    sort: sort === "name" || sort === "company" || sort === "added" ? sort : "score",
    dir: one("dir") === "asc" ? "asc" : "desc",
    page: Math.max(1, Math.floor(num("page") ?? 1)),
  };
}

/**
 * A way to reach the person: their own verified address or phone, or their
 * business's phone or email (from the map listing, or published on the site
 * they were found on). A guessed address is not one. People without any stay
 * stored but are not listed or exported (asked for on 17 Oct).
 */
const REACHABLE = sql`(
  (${people.emailStatus} = 'verified' and ${people.email} is not null)
  or ${people.phone} is not null
  or exists (
    select 1 from ${prospects} pr
    where ${companies.origin} = 'prospect' and pr.id = ${companies.originId}
      and (pr.phone_e164 is not null or pr.whatsapp_e164 is not null or pr.email is not null)
  )
  or exists (
    select 1 from ${peopleSources} ps
    where ps.company_id = ${companies.id} and ps.person_id is null and ps.field in ('email', 'phone')
  )
)`;

function where(f: PeopleFilter): SQL | undefined {
  const like = (v: string) => `%${v.replace(/[%_]/g, "")}%`;
  const parts: (SQL | undefined)[] = [
    REACHABLE,
    f.q
      ? or(
          ilike(people.name, like(f.q)),
          ilike(people.title, like(f.q)),
          ilike(companies.name, like(f.q)),
          ilike(people.email, like(f.q)),
        )
      : undefined,
    f.seniority?.length ? inArray(people.seniority, f.seniority) : undefined,
    f.industry ? ilike(companies.industry, like(f.industry)) : undefined,
    f.country ? eq(companies.countryCode, f.country) : undefined,
    f.category ? eq(companies.industry, f.category) : undefined,
    f.company ? eq(companies.id, f.company) : undefined,
    f.size ? eq(companies.sizeBand, f.size) : undefined,
    f.location ? ilike(companies.location, like(f.location)) : undefined,
    f.verified ? eq(people.emailStatus, "verified") : undefined,
    f.scoreMin !== undefined ? gte(people.score, f.scoreMin) : undefined,
    f.scoreMax !== undefined ? lte(people.score, f.scoreMax) : undefined,
    f.status ? eq(people.status, f.status) : undefined,
  ];
  const present = parts.filter((p): p is SQL => !!p);
  return present.length ? and(...present) : undefined;
}

const SELECT = {
  id: people.id,
  name: people.name,
  title: people.title,
  seniority: people.seniority,
  email: people.email,
  emailStatus: people.emailStatus,
  phone: people.phone,
  linkedinUrl: people.linkedinUrl,
  score: people.score,
  status: people.status,
  notes: people.notes,
  createdAt: people.createdAt,
  companyId: companies.id,
  company: companies.name,
  domain: companies.domain,
  industry: companies.industry,
  sizeBand: companies.sizeBand,
  location: companies.location,
  countryCode: companies.countryCode,
  // How many people the company has, for "+N more" in the one-per-business view.
  companyPeople: sql<number>`(select count(*)::int from ${people} p2 where p2.company_id = ${companies.id})`,
  // The local business this company came from, when it did: what Copy email writes about.
  prospectId: sql<string | null>`case when ${companies.origin} = 'prospect' then ${companies.originId} end`,
  // Which sources contributed anything to this person, for the table's column.
  sources: sql<string[]>`coalesce((select array_agg(distinct ${peopleSources.sourceType}) from ${peopleSources} where ${peopleSources.personId} = ${people.id}), '{}')`,
  // On the do-not-contact list: their address, its bounce, or the company's domain.
  blocked: sql<boolean>`exists (select 1 from ${suppressions} where (${suppressions.kind} in ('email', 'bounced') and ${suppressions.value} = lower(${people.email})) or (${suppressions.kind} = 'domain' and ${suppressions.value} = lower(${companies.domain})))`,
};

export type PersonRow = Awaited<ReturnType<typeof listPeople>>["rows"][number];

/**
 * Each company's best person among those the filter matches, ranked as
 * `bestOwner` ranks an addressee: a verified address first, then seniority,
 * then score.
 */
async function bestPerCompany(condition: SQL | undefined): Promise<string[]> {
  const rows = await getDb()
    .selectDistinctOn([people.companyId], { id: people.id })
    .from(people)
    .innerJoin(companies, eq(companies.id, people.companyId))
    .where(condition)
    .orderBy(
      people.companyId,
      sql`(${people.emailStatus} = 'verified') desc`,
      sql`case ${people.seniority} when 'founder_owner' then 0 when 'c_level' then 1 when 'vp' then 2 when 'director' then 3 else 9 end`,
      sql`${people.score} desc nulls last`,
      people.id,
    );
  return rows.map((r) => r.id);
}

export async function listPeople(f: PeopleFilter) {
  const db = getDb();
  const order = { score: people.score, name: people.name, company: companies.name, added: people.createdAt }[f.sort ?? "score"];
  const direction = f.dir === "asc" ? asc : desc;
  let condition = where(f);
  if (f.perBusiness) {
    const best = await bestPerCompany(condition);
    if (best.length === 0) return { rows: [], total: 0 };
    condition = and(condition ?? sql`true`, inArray(people.id, best));
  }
  const [rows, [{ total }]] = await Promise.all([
    db
      .select(SELECT)
      .from(people)
      .innerJoin(companies, eq(companies.id, people.companyId))
      .where(condition)
      .orderBy(direction(order), asc(people.id))
      .limit(PAGE_SIZE)
      .offset(((f.page ?? 1) - 1) * PAGE_SIZE),
    db
      .select({ total: count() })
      .from(people)
      .innerJoin(companies, eq(companies.id, people.companyId))
      .where(condition),
  ]);
  return { rows, total: Number(total) };
}

/** The Country and Category chips: every value present, with how many people each holds. */
export async function peopleFacets(): Promise<{ countries: Facet[]; categories: Facet[] }> {
  const db = getDb();
  const facet = (column: typeof companies.countryCode | typeof companies.industry) =>
    db
      .select({ name: sql<string>`${column}`, count: count() })
      .from(people)
      .innerJoin(companies, eq(companies.id, people.companyId))
      .where(and(REACHABLE, sql`${column} is not null`))
      .groupBy(column)
      .orderBy(desc(count()));
  const [countries, categories] = await Promise.all([facet(companies.countryCode), facet(companies.industry)]);
  const tidy = (rows: { name: string; count: number }[]) => rows.map((r) => ({ name: r.name, count: Number(r.count) }));
  return { countries: tidy(countries), categories: tidy(categories) };
}

export interface Facet {
  name: string;
  count: number;
}

/** One person, their company, and every fact grouped by field with its source. */
export async function personDetail(id: string) {
  const db = getDb();
  const [row] = await db
    .select({ ...SELECT, scoreReasons: people.scoreReasons, signals: companies.signals, companyOrigin: companies.origin })
    .from(people)
    .innerJoin(companies, eq(companies.id, people.companyId))
    .where(eq(people.id, id))
    .limit(1);
  if (!row) return null;
  const sources = await db
    .select()
    .from(peopleSources)
    .where(or(eq(peopleSources.personId, id), and(eq(peopleSources.companyId, row.companyId), sql`${peopleSources.personId} is null`)))
    .orderBy(asc(peopleSources.field), desc(peopleSources.fetchedAt));
  return { ...row, sources };
}

/** Whether a person is on the do-not-contact list now, after a status change. */
export async function blockedOf(id: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ blocked: SELECT.blocked })
    .from(people)
    .innerJoin(companies, eq(companies.id, people.companyId))
    .where(eq(people.id, id))
    .limit(1);
  return row?.blocked ?? false;
}

/**
 * Rows for CSV export: the do-not-contact list is checked first, whatever the
 * filter. A person marked do-not-contact, or whose address or domain is on the
 * list, is not exported. A guessed address is never exported: research only.
 */
export async function exportRows(f: PeopleFilter) {
  const db = getDb();
  const blocked = await db
    .select({ kind: suppressions.kind, value: suppressions.value })
    .from(suppressions)
    .where(inArray(suppressions.kind, ["email", "domain", "bounced"]));
  const emails = new Set(blocked.filter((b) => b.kind !== "domain").map((b) => b.value.toLowerCase()));
  const domains = new Set(blocked.filter((b) => b.kind === "domain").map((b) => b.value.toLowerCase()));

  const rows = await db
    .select(SELECT)
    .from(people)
    .innerJoin(companies, eq(companies.id, people.companyId))
    .where(and(where(f) ?? sql`true`, ne(people.status, "do_not_contact")))
    .orderBy(desc(people.score))
    .limit(5000);

  return rows
    .filter((r) => !(r.domain && domains.has(r.domain)))
    .filter((r) => !(r.email && (emails.has(r.email.toLowerCase()) || domains.has(r.email.split("@")[1]?.toLowerCase() ?? ""))))
    .map((r) => ({ ...r, email: r.emailStatus === "verified" ? r.email : null }));
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v);
  // Quote everything, double inner quotes, and defuse spreadsheet formulas.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

export function toCsv(rows: Awaited<ReturnType<typeof exportRows>>): string {
  const header = [
    "name", "title", "seniority", "company", "website", "industry", "company_size", "location",
    "email", "email_status", "phone", "linkedin_url", "sources", "score", "status", "added",
  ];
  const lines = rows.map((r) =>
    [
      r.name, r.title, r.seniority, r.company, r.domain ? `https://${r.domain}` : "", r.industry, r.sizeBand,
      r.location, r.email, r.email ? r.emailStatus : "", r.phone, r.linkedinUrl, (r.sources ?? []).join(" "),
      r.score, r.status, r.createdAt,
    ].map(csvCell).join(","),
  );
  return [header.join(","), ...lines].join("\r\n");
}
