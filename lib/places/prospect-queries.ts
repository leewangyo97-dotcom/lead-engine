import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { prospects, searches } from "../db/schema";
import { isWhatsAppCapable } from "./phone";

export interface ProspectRow {
  id: string;
  name: string;
  category: string;
  city: string | null;
  website: string | null;
  email: string | null;
  phoneE164: string | null;
  whatsappE164: string | null;
  enrichmentStatus: string;
  lastRefreshedAt: Date | null;
  score: number | null;
  /** Field names a person corrected by hand, so the table can mark them. */
  overridden: string[];
  /** Precomputed here so the table does not parse phone numbers per render. */
  whatsappReady: boolean;
}

export async function getSearch(searchId: string) {
  const db = getDb();
  const [row] = await db.select().from(searches).where(eq(searches.id, searchId)).limit(1);
  return row ?? null;
}

export async function listSearches(limit = 10) {
  const db = getDb();
  return db.select().from(searches).orderBy(desc(searches.createdAt)).limit(limit);
}

export async function getProspects(searchId: string, limit = 200): Promise<ProspectRow[]> {
  const db = getDb();

  const rows = await db
    .select({
      id: prospects.id,
      name: prospects.name,
      category: prospects.category,
      city: prospects.city,
      website: prospects.website,
      email: prospects.email,
      phoneE164: prospects.phoneE164,
      whatsappE164: prospects.whatsappE164,
      enrichmentStatus: prospects.enrichmentStatus,
      lastRefreshedAt: prospects.lastRefreshedAt,
      score: prospects.score,
      manualOverrides: prospects.manualOverrides,
    })
    .from(prospects)
    .where(eq(prospects.searchId, searchId))
    // Reachable first: a prospect with no way to contact it is not yet a lead,
    // whatever else is known about it.
    .orderBy(
      desc(sql`(${prospects.whatsappE164} is not null)`),
      desc(sql`(${prospects.email} is not null)`),
      desc(sql`(${prospects.phoneE164} is not null)`),
      prospects.name,
    )
    .limit(limit);

  return rows.map(({ manualOverrides, ...r }) => ({
    ...r,
    whatsappReady: isWhatsAppCapable(r.whatsappE164 ?? r.phoneE164),
    overridden: Object.keys(manualOverrides ?? {}),
  }));
}

export interface ProspectStats {
  total: number;
  withPhone: number;
  withEmail: number;
  withWebsite: number;
}

export async function getProspectStats(searchId: string): Promise<ProspectStats> {
  const db = getDb();
  const rows = await db.execute(sql`
    select
      count(*)::int as total,
      count(*) filter (where phone_e164 is not null)::int as with_phone,
      count(*) filter (where email is not null)::int as with_email,
      count(*) filter (where website is not null)::int as with_website
    from prospects where search_id = ${searchId}
  `);

  const r = rows.rows[0] as {
    total: number;
    with_phone: number;
    with_email: number;
    with_website: number;
  };

  return {
    total: r?.total ?? 0,
    withPhone: r?.with_phone ?? 0,
    withEmail: r?.with_email ?? 0,
    withWebsite: r?.with_website ?? 0,
  };
}
