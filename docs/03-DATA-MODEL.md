# Data Model

Drizzle schema, one file: `lib/db/schema.ts`. Postgres on Neon.

Design constraints: 0.5 GB total, and a model may read this file — so keep it
compact and self-explaining.

```ts
import { pgTable, text, integer, timestamp, boolean, jsonb, index, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'

export const leadStatus = pgEnum('lead_status', [
  'harvested', 'disqualified', 'needs_scoring', 'scored',
  'parked', 'needs_draft', 'drafted', 'in_gmail',
  'answered', 'won', 'lost', 'closed',
])

export const leadKind = pgEnum('lead_kind', ['job', 'funding', 'cofounder'])

/* ── sources ─────────────────────────────────────────── */
export const sources = pgTable('sources', {
  id:        text('id').primaryKey(),            // 'hn-whoishiring'
  label:     text('label').notNull(),
  enabled:   boolean('enabled').notNull().default(true),
  lastRunAt: timestamp('last_run_at'),
  lastOk:    boolean('last_ok').notNull().default(true),
  lastError: text('last_error'),
})

/* ── leads ───────────────────────────────────────────── */
export const leads = pgTable('leads', {
  id:          text('id').primaryKey().$defaultFn(createId),
  sourceId:    text('source_id').notNull().references(() => sources.id),
  kind:        leadKind('kind').notNull().default('job'),
  status:      leadStatus('status').notNull().default('harvested'),

  // identity — contentHash is the dedupe key, see token budget rule 2
  contentHash: text('content_hash').notNull(),
  externalId:  text('external_id'),              // HN comment id, RemoteOK slug

  // normalised payload — the ONLY shape downstream code sees
  company:     text('company').notNull(),
  title:       text('title').notNull(),
  region:      text('region'),                   // verbatim from the posting
  remoteScope: text('remote_scope'),             // 'worldwide'|'apac'|'emea'|'us'|'onsite'
  isContract:  boolean('is_contract').notNull().default(false),
  contact:     text('contact'),                  // email if present
  isDirect:    boolean('is_direct').notNull().default(false),  // personal inbox, not ATS
  url:         text('url'),
  payRaw:      text('pay_raw'),
  payMinUsdHr: integer('pay_min_usd_hr'),        // normalised where derivable
  stack:       jsonb('stack').$type<string[]>().notNull().default([]),
  summary:     text('summary'),                  // TRUNCATED to 400 chars at ingest
  triggerEvent:text('trigger_event'),            // 'raised $10M seed 6d ago'

  // timezone honesty — computed at ingest, never guessed
  overlapHours:integer('overlap_hours'),         // hrs/day overlapping 09:00-18:00 Manila

  postedAt:    timestamp('posted_at'),
  harvestedAt: timestamp('harvested_at').notNull().defaultNow(),
}, t => ({
  hashIdx:   uniqueIndex('leads_hash_idx').on(t.contentHash),
  statusIdx: index('leads_status_idx').on(t.status),
  coIdx:     index('leads_company_idx').on(t.company),
}))

/* ── scores ──────────────────────────────────────────── */
export const scores = pgTable('scores', {
  id:         text('id').primaryKey().$defaultFn(createId),
  leadId:     text('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  preScore:   integer('pre_score').notNull(),    // deterministic, free
  modelScore: integer('model_score'),            // null until stage 2
  tier:       text('tier'),                      // 'live' | 'warn' | 'cold'
  reason:     text('reason'),                    // CAPPED 120 chars
  rubricVer:  text('rubric_version').notNull(),  // so old scores stay interpretable
  scoredAt:   timestamp('scored_at').notNull().defaultNow(),
}, t => ({ leadIdx: index('scores_lead_idx').on(t.leadId) }))

/* ── outreach ────────────────────────────────────────── */
export const outreach = pgTable('outreach', {
  id:          text('id').primaryKey().$defaultFn(createId),
  leadId:      text('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  step:        integer('step').notNull().default(0),   // 0 first touch, 1 & 2 follow-ups
  subject:     text('subject').notNull(),
  body:        text('body').notNull(),
  proofUsed:   jsonb('proof_used').$type<string[]>(),  // which PROFILE proof points
  angle:       text('angle'),                          // for the learning loop
  gmailDraftId:text('gmail_draft_id'),
  verifiedAt:  timestamp('verified_at'),               // null = verifier has NOT passed it
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  sentAt:      timestamp('sent_at'),                   // set by hand when Joshua sends
  dueAt:       timestamp('due_at'),                    // follow-up scheduling
}, t => ({ leadIdx: index('outreach_lead_idx').on(t.leadId) }))

/* ── events — raw material for the learning loop ─────── */
export const events = pgTable('events', {
  id:        text('id').primaryKey().$defaultFn(createId),
  leadId:    text('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
  type:      text('type').notNull(),   // status_change|draft_created|sent|reply|call|won|lost
  meta:      jsonb('meta'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => ({ typeIdx: index('events_type_idx').on(t.type) }))

/* ── run metrics — enforces the token budget ─────────── */
export const runMetrics = pgTable('run_metrics', {
  id:            text('id').primaryKey().$defaultFn(createId),
  runAt:         timestamp('run_at').notNull().defaultNow(),
  rawCount:      integer('raw_count').notNull(),
  afterHash:     integer('after_hash').notNull(),
  afterFilter:   integer('after_filter').notNull(),
  scoredCount:   integer('scored_count').notNull(),
  draftedCount:  integer('drafted_count').notNull(),
  tokensIn:      integer('tokens_in'),
  tokensOut:     integer('tokens_out'),
  durationMs:    integer('duration_ms'),
})
```

## Rules

**`summary` is truncated to 400 characters at ingest, not at read time.** If the
full text is stored, someone will eventually select it into a prompt. Truncating
at the boundary makes the token budget structural instead of a discipline problem.

**`contentHash` must be stable.** Compute it from
`company | title | region | summary.slice(0,500)` — never from anything containing a
timestamp, a view count, or a position in a list. An unstable hash silently defeats
the single biggest cost saving in the system. Phase 1's exit test checks exactly this.

**`rubricVersion` is recorded on every score.** When weights change, old scores
remain interpretable and the learning loop can compare like with like.

**`verifiedAt` gates Gmail.** A row with `verifiedAt = null` must never reach
`drafts.create`. Enforce it in the query, not in a comment.

**Retention:** delete `leads` where `status IN ('disqualified','parked','closed')`
and `harvestedAt < now() - 45 days`. A monthly Actions job. Keeps storage flat and
keeps the dashboard about this month, not last year.
