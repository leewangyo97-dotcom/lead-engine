import { and, desc, eq, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "../db";
import { prospects, searches } from "../db/schema";
import { isWhatsAppCapable } from "./phone";
import { chooseChannel, type ContactOption } from "./contact";
import { isScoreProvisional, scoreProspect } from "./score";
import { contactedIds } from "./outreach-log";

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
  /** Whether each channel can be used, with the reason when it cannot. */
  whatsapp: ContactOption;
  emailChannel: ContactOption;
  contacted: boolean;
  /** On the do-not-contact list, so the row offers no way to message them. */
  declined: boolean;
  status: string;
  tier: "hot" | "warm" | "cold";
  /** Why the score is what it is, largest contribution first. */
  scoreReasons: [string, number][];
  /** True when the site has never been read, so the score is contacts only. */
  provisional: boolean;
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

/**
 * The work queue: the best prospects to message next, across every search.
 *
 * Without this the page could only show one search at a time, so working the
 * list meant choosing a search first and comparing scores by memory. Contacted
 * and declined rows are gone from it — this answers "who next", not "what did we
 * find".
 */
export async function getTopProspects(limit = 25): Promise<ProspectRow[]> {
  return queryProspects(
    and(
      eq(prospects.status, "new"),
      or(isNotNull(prospects.phoneE164), isNotNull(prospects.email)),
    ),
    limit,
  );
}

export async function getProspects(searchId: string, limit = 200): Promise<ProspectRow[]> {
  return queryProspects(eq(prospects.searchId, searchId), limit);
}

async function queryProspects(where: SQL | undefined, limit: number): Promise<ProspectRow[]> {
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
      status: prospects.status,
      score: prospects.score,
      scoreReasons: prospects.scoreReasons,
      siteSignals: prospects.siteSignals,
      manualOverrides: prospects.manualOverrides,
    })
    .from(prospects)
    .where(where)
    // Score first, since reachability is the largest thing the score is made of
    // — sorting by both would just be sorting by reachability twice. Unscored
    // rows sort last rather than as zero: not yet judged is not the same as
    // judged badly.
    .orderBy(
      // People who said no sink to the bottom whatever they score: the top of
      // this list is a work queue, and they are not in it.
      sql`(${prospects.status} = 'do_not_contact')`,
      sql`${prospects.score} desc nulls last`,
      desc(sql`(${prospects.whatsappE164} is not null)`),
      prospects.name,
    )
    .limit(limit);

  // One query for the contact history rather than one per row.
  const contacted = await contactedIds(rows.map((r) => r.id));

  return rows.map(({ manualOverrides, siteSignals, scoreReasons, ...r }) => {
    const plan = chooseChannel(r);
    // Scored here as well as by the script so a freshly found prospect is not
    // shown blank until someone remembers to run `pnpm prospects:score`.
    const live = scoreProspect({ ...r, siteSignals });
    return {
      ...r,
      score: r.score ?? live.score,
      tier: live.tier,
      scoreReasons: Object.entries(scoreReasons ?? live.reasons).sort((a, b) => b[1] - a[1]),
      provisional: isScoreProvisional({ ...r, siteSignals }),
      whatsappReady: isWhatsAppCapable(r.whatsappE164 ?? r.phoneE164),
      overridden: Object.keys(manualOverrides ?? {}),
      whatsapp: plan.whatsapp,
      emailChannel: plan.email,
      contacted: contacted.has(r.id),
      declined: r.status === "do_not_contact",
    };
  });
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
