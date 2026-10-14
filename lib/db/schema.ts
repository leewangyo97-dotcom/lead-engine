import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  doublePrecision,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const leadStatus = pgEnum("lead_status", [
  "harvested",
  "disqualified",
  "needs_scoring",
  "scored",
  "parked",
  "needs_draft",
  "drafted",
  "in_gmail",
  /**
   * The email has actually gone out.
   *
   * `in_gmail` means a draft is sitting in the mailbox waiting for a human;
   * leaving a sent lead at that status made the funnel report read
   * "in_gmail=2" for two applications that were already delivered, which is the
   * opposite of what a person reading it needs to know.
   */
  "sent",
  "answered",
  "won",
  "lost",
  "closed",
]);

export const leadKind = pgEnum("lead_kind", ["job", "funding", "cofounder"]);

/* ── sources ─────────────────────────────────────────── */
export const sources = pgTable("sources", {
  id: text("id").primaryKey(), // 'hn-whoishiring'
  label: text("label").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  lastRunAt: timestamp("last_run_at"),
  lastOk: boolean("last_ok").notNull().default(true),
  lastError: text("last_error"),
  // Raw items this source returned on its last run. A total across all sources
  // cannot say which adapter went quiet, and an adapter that half-fails is the
  // failure mode that does not announce itself.
  lastRawCount: integer("last_raw_count"),
});

/* ── leads ───────────────────────────────────────────── */
export const leads = pgTable(
  "leads",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id),
    kind: leadKind("kind").notNull().default("job"),
    status: leadStatus("status").notNull().default("harvested"),

    // identity — contentHash is the dedupe key, see docs/05-TOKEN-BUDGET.md rule 2
    contentHash: text("content_hash").notNull(),
    externalId: text("external_id"), // HN comment id, RemoteOK slug

    // normalised payload — the ONLY shape downstream code sees
    company: text("company").notNull(),
    title: text("title").notNull(),
    region: text("region"), // verbatim from the posting
    remoteScope: text("remote_scope"), // 'worldwide'|'apac'|'emea'|'us'|'onsite'
    isContract: boolean("is_contract").notNull().default(false),
    contact: text("contact"), // email if present
    isDirect: boolean("is_direct").notNull().default(false), // personal inbox, not ATS
    url: text("url"),
    payRaw: text("pay_raw"),
    payMinUsdHr: integer("pay_min_usd_hr"), // normalised where derivable
    stack: jsonb("stack").$type<string[]>().notNull().default([]),
    summary: text("summary"), // TRUNCATED to 400 chars at ingest
    triggerEvent: text("trigger_event"), // 'raised $10M seed 6d ago'

    // timezone honesty — computed at ingest, never guessed
    overlapHours: integer("overlap_hours"), // hrs/day overlapping 09:00-18:00 Manila

    postedAt: timestamp("posted_at"),
    harvestedAt: timestamp("harvested_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("leads_hash_idx").on(t.contentHash),
    index("leads_status_idx").on(t.status),
    index("leads_company_idx").on(t.company),
  ],
);

/* ── scores ──────────────────────────────────────────── */
export const scores = pgTable(
  "scores",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    preScore: integer("pre_score").notNull(), // deterministic, free
    modelScore: integer("model_score"), // null until stage 2
    tier: text("tier"), // 'live' | 'warn' | 'cold'
    reason: text("reason"), // CAPPED 120 chars
    rubricVer: text("rubric_version").notNull(), // so old scores stay interpretable
    scoredAt: timestamp("scored_at").notNull().defaultNow(),
  },
  (t) => [index("scores_lead_idx").on(t.leadId)],
);

/* ── outreach ────────────────────────────────────────── */
export const outreach = pgTable(
  "outreach",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    // Exactly one of these is set. Job postings and geo prospects share the
    // outreach history deliberately: the learning loop measures reply rates
    // across everything sent, not per source of lead.
    leadId: text("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    prospectId: text("prospect_id").references(() => prospects.id, { onDelete: "cascade" }),
    channel: text("channel").notNull().default("email"), // "email" | "whatsapp"
    step: integer("step").notNull().default(0), // 0 first touch, 1 & 2 follow-ups
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    proofUsed: jsonb("proof_used").$type<string[]>(), // which PROFILE proof points
    angle: text("angle"), // for the learning loop
    gmailDraftId: text("gmail_draft_id"),
    verifiedAt: timestamp("verified_at"), // null = verifier has NOT passed it
    createdAt: timestamp("created_at").notNull().defaultNow(),
    sentAt: timestamp("sent_at"), // set by hand when Joshua sends
    dueAt: timestamp("due_at"), // follow-up scheduling
    // Where a prospect email went, and to whom (lib/places/recipient.ts): the
    // owner's own address or the business's. Follow-ups go to the same place,
    // and "it bounced" blocks this address rather than whatever is on file now.
    // Null on rows before 14 Oct, which all went to the business address.
    toAddress: text("to_address"),
    personId: text("person_id").references((): AnyPgColumn => people.id, { onDelete: "set null" }),
  },
  (t) => [
    index("outreach_lead_idx").on(t.leadId),
    index("outreach_prospect_idx").on(t.prospectId),
    /*
     * Exactly one owner, enforced by the database.
     *
     * Three bugs came from queries forgetting that this table holds both job
     * applications and messages to businesses: the inbox counted prospect
     * drafts as job drafts, follow-ups skipped prospects entirely, and a written
     * draft silenced a company for 90 days. Each was fixed by remembering to
     * filter. This is the version that does not rely on remembering — a row with
     * both owners, or neither, cannot exist.
     */
    check(
      "outreach_exactly_one_owner",
      sql`(${t.leadId} is not null) <> (${t.prospectId} is not null)`,
    ),
  ],
);

/* ── events — raw material for the learning loop ─────── */
export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    leadId: text("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // status_change|draft_created|sent|reply|call|won|lost
    meta: jsonb("meta"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("events_type_idx").on(t.type)],
);

/* ── geo prospecting: searches and prospects ─────────── */

/**
 * `prospects`, not `leads`. The existing leads table holds job postings
 * harvested from HN and RemoteOK; these are businesses discovered from
 * OpenStreetMap. Same word in the spec, different entity — sharing the table
 * would put schools and job adverts through the same scoring rubric.
 */
export const searchStatus = pgEnum("search_status", [
  "queued",
  "discovering",
  "enriching",
  "complete",
  "failed",
]);

export const prospectStatus = pgEnum("prospect_status", [
  "new",
  "queued",
  "contacted",
  "replied",
  "won",
  "lost",
  "do_not_contact",
]);

export const enrichmentStatus = pgEnum("enrichment_status", [
  "pending",
  "enriched",
  "no_website",
  "fetch_failed",
  "robots_blocked",
  /** The site answered, and answered "no" — a 401, 403 or 451. */
  "site_refused",
  "no_contact_found",
]);

export const searches = pgTable("searches", {
  id: text("id").primaryKey().$defaultFn(createId),
  query: text("query").notNull(), // what the user typed
  resolvedName: text("resolved_name"),
  lat: doublePrecision("lat"),
  lon: doublePrecision("lon"),
  radiusM: integer("radius_m"),
  countryCode: text("country_code"),
  osmId: integer("osm_id"),
  isArea: boolean("is_area").notNull().default(false),
  categories: jsonb("categories").$type<string[]>().notNull().default([]),
  status: searchStatus("status").notNull().default("queued"),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const prospects = pgTable(
  "prospects",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    searchId: text("search_id")
      .notNull()
      .references(() => searches.id, { onDelete: "cascade" }),
    sourceId: text("source_id").notNull(), // "osm:node/123456"
    sourceProvider: text("source_provider").notNull(),

    name: text("name").notNull(),
    /** Lowercased, punctuation and legal suffixes stripped, for cross-search dedupe. */
    normalizedName: text("normalized_name").notNull(),
    category: text("category").notNull(),
    website: text("website"),
    rootDomain: text("root_domain"),
    addressLine: text("address_line"),
    city: text("city"),
    countryCode: text("country_code"),
    lat: doublePrecision("lat"),
    lon: doublePrecision("lon"),

    email: text("email"),
    /** How the email was obtained — a mailto: link is worth more than a regex hit. */
    emailConfidence: text("email_confidence"),
    phoneE164: text("phone_e164"),
    /** Scraped from a wa.me link: a confirmed WhatsApp number, not a guess. */
    whatsappE164: text("whatsapp_e164"),
    facebookUrl: text("facebook_url"),
    instagramUrl: text("instagram_url"),
    linkedinUrl: text("linkedin_url"),
    contactName: text("contact_name"),

    enrichmentStatus: enrichmentStatus("enrichment_status").notNull().default("pending"),
    lastEnrichedAt: timestamp("last_enriched_at"),
    lastRefreshedAt: timestamp("last_refreshed_at"),

    /**
     * What Stage B observed about their website, kept so scoring reads measured
     * facts instead of fetching the site again every time weights change.
     */
    siteSignals: jsonb("site_signals").$type<Record<string, unknown>>(),

    score: integer("score"),
    scoreReasons: jsonb("score_reasons").$type<Record<string, number>>(),

    status: prospectStatus("status").notNull().default("new"),
    /**
     * Hand edits, re-applied over scraped values after every refresh. Without
     * this a correction survives until the next refresh and then vanishes,
     * which is the failure that makes people stop trusting a refresh button.
     */
    manualOverrides: jsonb("manual_overrides").$type<Record<string, unknown>>(),

    /**
     * The one-page demo made for a business with no website (lib/demo). The slug
     * is the page's path on the demo site. It is set only once the page has been
     * published, because the first email links to it, and a link to a page that
     * is not there is worse than no link at all.
     */
    demoSlug: text("demo_slug"),
    demoPublishedAt: timestamp("demo_published_at"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("prospects_search_source_idx").on(t.searchId, t.sourceId),
    // Cross-search dedupe: the same clinic found by two searches is one business.
    uniqueIndex("prospects_identity_idx").on(t.countryCode, t.normalizedName, t.addressLine),
    index("prospects_status_idx").on(t.status),
    index("prospects_score_idx").on(t.score),
  ],
);

/**
 * A global suppression list, authoritative over every future search.
 * Contacting someone again after they declined is how a sender reputation dies,
 * so this is keyed loosely — an email, a domain or a phone number all match.
 */
export const suppressions = pgTable(
  "suppressions",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    kind: text("kind").notNull(), // "email" | "domain" | "phone"
    value: text("value").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("suppressions_kind_value_idx").on(t.kind, t.value)],
);

/* ── run metrics — enforces the token budget ─────────── */
export const runMetrics = pgTable("run_metrics", {
  id: text("id").primaryKey().$defaultFn(createId),
  runAt: timestamp("run_at").notNull().defaultNow(),
  rawCount: integer("raw_count").notNull(),
  afterHash: integer("after_hash").notNull(),
  afterFilter: integer("after_filter").notNull(),
  scoredCount: integer("scored_count").notNull(),
  draftedCount: integer("drafted_count").notNull(),
  tokensIn: integer("tokens_in"),
  tokensOut: integer("tokens_out"),
  durationMs: integer("duration_ms"),
});

/* ── runs — Phase 3 keepalive touches this ───────────── */
export type Prospect = typeof prospects.$inferSelect;
export type NewProspect = typeof prospects.$inferInsert;
export type Search = typeof searches.$inferSelect;

export const runs = pgTable("runs", {
  // serial, not cuid, because this table shipped in migration 0000 and
  // migrations here are forward-only.
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  note: text("note"),
});

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type Run = typeof runs.$inferSelect;

/*
 * Decision-makers (/people), added 14 Oct.
 *
 * People at companies: owners, founders, C-level, VPs and directors, found on
 * public business sources and kept with where each fact came from. Separate
 * from `prospects`, which are businesses found on the map. A company may start
 * as one of those, or as a lead's company, or as a domain typed in.
 *
 * The do-not-contact list is the existing `suppressions` table, not a second
 * one. A person marked "do not contact" adds their address there, so every
 * export and every send path refuses it the same way.
 */
export const companies = pgTable(
  "companies",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    name: text("name").notNull(),
    /** Lower-case registrable domain. Null for a registry company with no site known yet. */
    domain: text("domain"),
    industry: text("industry"),
    /** "1-10" | "11-50" | "51-200" | "201-1000" | "1000+", when a source says. */
    sizeBand: text("size_band"),
    location: text("location"),
    countryCode: text("country_code"),
    /** What says they need software work: outdated site, no app, hiring, funding, stack. */
    signals: jsonb("signals").$type<Record<string, unknown>>(),
    /** Where the company came from: "prospect" | "lead" | "manual". */
    origin: text("origin").notNull(),
    originId: text("origin_id"),
    lastDiscoveredAt: timestamp("last_discovered_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("companies_domain_idx").on(t.domain)],
);

export const people = pgTable(
  "people",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    title: text("title"),
    /** "c_level" | "founder_owner" | "vp" | "director" | "other". */
    seniority: text("seniority").notNull().default("other"),
    email: text("email"),
    /**
     * "verified": published by the company itself. "guessed": built from the
     * company's email pattern, research only, never copied or sent. "unknown".
     */
    emailStatus: text("email_status").notNull().default("unknown"),
    phone: text("phone"),
    /** A link only. LinkedIn is never fetched. */
    linkedinUrl: text("linkedin_url"),
    score: integer("score"),
    scoreReasons: jsonb("score_reasons").$type<Record<string, number>>(),
    /** new → contacted → replied → qualified | not_interested | do_not_contact. */
    status: text("status").notNull().default("new"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("people_company_name_idx").on(t.companyId, t.name),
    index("people_score_idx").on(t.score),
  ],
);

/** Every fact about a person or company, and where it was read. */
export const peopleSources = pgTable(
  "people_sources",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    personId: text("person_id").references(() => people.id, { onDelete: "cascade" }),
    companyId: text("company_id").references(() => companies.id, { onDelete: "cascade" }),
    /** "name" | "title" | "email" | "phone" | "linkedinUrl" | "industry" | "signals" | … */
    field: text("field").notNull(),
    value: text("value"),
    sourceUrl: text("source_url"),
    /** "website" | "email_pattern" | "edgar" | "github" | "manual". */
    sourceType: text("source_type").notNull(),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  },
  (t) => [index("people_sources_person_idx").on(t.personId)],
);

/** One discovery run, started from /people, with its progress for the page. */
export const discoveryJobs = pgTable("discovery_jobs", {
  id: text("id").primaryKey().$defaultFn(createId),
  /** "companies": discover the listed company ids. */
  kind: text("kind").notNull(),
  input: jsonb("input").$type<{ companyIds: string[] }>().notNull(),
  /** "queued" | "running" | "done" | "failed". */
  status: text("status").notNull().default("queued"),
  progress: integer("progress").notNull().default(0),
  total: integer("total").notNull().default(0),
  /** Counts only. The repository is public, and so are its Actions logs. */
  message: text("message"),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Company = typeof companies.$inferSelect;
export type Person = typeof people.$inferSelect;
