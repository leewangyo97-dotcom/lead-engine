import { createId } from "@paralleldrive/cuid2";
import {
  boolean,
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
  },
  (t) => [index("outreach_lead_idx").on(t.leadId)],
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

    score: integer("score"),
    scoreReasons: jsonb("score_reasons").$type<Record<string, number>>(),

    status: prospectStatus("status").notNull().default("new"),
    /**
     * Hand edits, re-applied over scraped values after every refresh. Without
     * this a correction survives until the next refresh and then vanishes,
     * which is the failure that makes people stop trusting a refresh button.
     */
    manualOverrides: jsonb("manual_overrides").$type<Record<string, unknown>>(),

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
