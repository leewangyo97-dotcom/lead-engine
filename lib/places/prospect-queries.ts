import { and, desc, eq, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "../db";
import { prospects, searches } from "../db/schema";
import { chooseChannel, type ContactOption } from "./contact";
import { dedupeByPhone } from "./dedupe-queue";
import type { QueueFilter } from "./queue-filter";
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
  /**
   * Whether WhatsApp can be used at all — the same answer the button gives,
   * taken from the contact plan rather than worked out a second time.
   */
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

/** The rows the queue draws from, before any narrowing. */
const QUEUE_POPULATION = and(
  eq(prospects.status, "new"),
  or(isNotNull(prospects.phoneE164), isNotNull(prospects.email)),
);

/**
 * What the queue can be narrowed by, with a count each.
 *
 * One query for both lists. A chip that does not say how many rows are behind it
 * is a guess, and the counts are the reason to click one: 5,162 schools sitting
 * above 1,206 clinics is the shape of this table, and invisible without them.
 *
 * Cities are capped because OpenStreetMap localities are a long tail — hundreds
 * of Australian suburbs with one row each are not a filter, they are a list.
 */
export interface QueueOptions {
  cities: { name: string; count: number }[];
  categories: { name: string; count: number }[];
}

export async function getQueueOptions(cityLimit = 12): Promise<QueueOptions> {
  const db = getDb();

  const rows = await db.execute(sql`
    with queue as (
      select city, category from prospects
      where status = 'new' and (phone_e164 is not null or email is not null)
    )
    -- Each arm is parenthesised: an unwrapped order-by-limit on the first
    -- select binds to the whole union, which is a syntax error here and would
    -- have been a wrong answer if it had parsed.
    (
      select 'city' as kind, city as name, count(*)::int as n
        from queue where city is not null group by city
        order by n desc limit ${cityLimit}
    )
    union all
    (
      select 'category' as kind, category as name, count(*)::int as n
        from queue group by category order by n desc
    )
  `);

  const all = rows.rows as unknown as { kind: string; name: string; n: number }[];
  const pick = (kind: string) =>
    all
      .filter((r) => r.kind === kind)
      .map((r) => ({ name: r.name, count: r.n }))
      .sort((a, b) => b.count - a.count);

  return { cities: pick("city"), categories: pick("category") };
}

/**
 * The work queue: the best prospects to message next, across every search.
 *
 * Without this the page could only show one search at a time, so working the
 * list meant choosing a search first and comparing scores by memory. Contacted
 * and declined rows are gone from it — this answers "who next", not "what did we
 * find".
 */
export async function getTopProspects(limit = 25, filter: QueueFilter = {}): Promise<ProspectRow[]> {
  // Over-fetched, then thinned to one row per phone number. Ninety-five rows in
  // this table share a number with another business — a council switchboard
  // answering for twelve preschools — and serving those as separate work means
  // messaging one number twelve times. Four times the limit is comfortably more
  // than the worst run of shared numbers seen, and the extra rows cost nothing:
  // it is one query either way.
  const rows = await queryProspects(
    and(
      QUEUE_POPULATION,
      filter.city ? eq(prospects.city, filter.city) : undefined,
      filter.category ? eq(prospects.category, filter.category) : undefined,
    ),
    limit * 4,
  );
  return dedupeByPhone(rows).slice(0, limit);
}

/**
 * One prospect, whatever its status.
 *
 * The follow-up list links here. Every row on it has been contacted, and the
 * queue lists only `new`, so before this a prospect follow-up linked to a page
 * that could not contain it — sixteen of them come due on 13 September and every
 * link would have gone nowhere useful.
 *
 * No status filter on purpose: a contacted prospect is exactly who this is for,
 * and a declined one should still be reachable so the undo can be found.
 */
export async function getProspect(id: string): Promise<ProspectRow | null> {
  const [row] = await queryProspects(eq(prospects.id, id), 1);
  return row ?? null;
}

export async function getProspects(
  searchId: string,
  limit = 200,
  offset = 0,
): Promise<ProspectRow[]> {
  return queryProspects(eq(prospects.searchId, searchId), limit, offset);
}

async function queryProspects(
  where: SQL | undefined,
  limit: number,
  offset = 0,
): Promise<ProspectRow[]> {
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
      // A unique last key, so paging is stable. Score, reachability and name all
      // tie — a country search has hundreds of rows named "Medical Centre" on
      // the same score — and Postgres is free to order tied rows differently
      // between queries, which makes an offset skip some rows and repeat others.
      prospects.id,
    )
    .limit(limit)
    .offset(offset);

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
      // Taken from the plan, not computed again. The second copy of this rule
      // disagreed with the first the moment published numbers began to outrank
      // the classifier: Dresden Vision's row showed a confirmed WhatsApp button
      // beside a chip reading "no whatsapp".
      whatsappReady: plan.whatsapp.available,
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
