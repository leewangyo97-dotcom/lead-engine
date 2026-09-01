# Build Plan — Lead Engine

Six phases. Each ends with something that works. Do not start a phase until the
previous one's exit test passes.

Estimated total: ~5 focused sessions.

---

## Phase 0 — Skeleton (½ session)

- `pnpm create next-app` — TypeScript, App Router, Tailwind
- Drizzle + `@neondatabase/serverless`, Neon project created, `DATABASE_URL` set
- `pnpm typecheck`, `pnpm test`, `pnpm db:migrate` scripts wired
- Deploy to Vercel Hobby, confirm the placeholder page loads

**Exit test:** a deployed URL returns 200 and `pnpm db:migrate` applies on a fresh
Neon branch.

---

## Phase 1 — Data model + one source (1 session)

- Full schema from `docs/03-DATA-MODEL.md`, migration checked in
- **One** adapter: `lib/sources/hn-whoishiring.ts`, implementing the contract in
  `.claude/skills/source-adapter/SKILL.md`
- `scripts/harvest.ts` — fetch, normalise, content-hash, upsert
- Vitest covering: normalisation, hash stability, upsert idempotency

**Exit test:** run harvest twice. Second run inserts **zero** new rows and updates
zero hashes. If it doesn't, the hash is unstable — fix before continuing.

---

## Phase 2 — The free filter (½ session)

Everything here is deterministic. No model calls anywhere in this phase.

- `lib/scoring/disqualify.ts` — hard rejects (region blocklist, non-engineering
  titles, stale listings, contacted-within-90-days, disqualified stacks)
- `lib/scoring/prescore.ts` — rule-based 0–100 from `memory/RUBRIC.md` weights
- `scripts/prefilter.ts` — marks survivors `status='needs_scoring'`

**Exit test:** on a real harvest of ~400 rows, fewer than 25 reach
`needs_scoring`. If more do, tighten the threshold — stage 2 cost scales with this
number and nothing else.

---

## Phase 3 — Scheduler (½ session)

- `.github/workflows/nightly.yml` — cron `0 20 * * 1-5` UTC (= 4am Manila), runs
  harvest then prefilter
- Secrets in GitHub, not in the repo
- A keepalive step: GitHub disables scheduled workflows after 60 days of repo
  inactivity, so the workflow touches a `last_run` row to keep the repo active

**Exit test:** the workflow runs green on schedule twice, and rows appear in Neon
without anyone touching a terminal.

---

## Phase 4 — UI (1 session)

Build to `docs/04-UI-SPEC.md`. Read it then, not now.

- Inbox view: today's leads, sorted by score, keyboard triage
- Lead detail: why it scored, the trigger event, timezone overlap, contact
- Draft review: generated email, edit in place, "Create Gmail draft" button
- Settings: rubric weights, source toggles, region blocklist

**Exit test:** the whole day's list can be triaged in under two minutes using only
the keyboard.

---

## Phase 5 — The model layer (1 session)

- `lib/model/` — batch score, batch draft, verify. Zod schemas for all three.
- Gmail OAuth (`gmail.compose` scope only) and `drafts.create`
- `.claude/commands/daily-run.md` orchestrates the sequence
- `run_metrics` table + `pnpm tokens`

**Exit test:** `/daily-run` produces Gmail drafts for the day, `verifier` passes,
and `pnpm tokens` reports under 25,000 for the run.

---

## Phase 6 — The learning loop (1 session)

This is the part that makes the tool improve rather than just persist. See
`docs/06-FEATURES.md`.

- Outcome logging: `no_reply | reply | call | won`, captured from the UI
- Weekly rollup: reply rate by source, by stack, by opening line, by send day
- Rubric feedback: surface which weights correlate with replies, propose changes,
  **never auto-apply** — Joshua approves, and the change is logged in DECISIONS.md
- Follow-up ladder: day 4 and day 11 drafts auto-queued for anything unanswered

**Exit test:** after 20 logged outcomes, the weekly rollup produces at least one
concrete, evidence-backed suggestion.

---

## Order of operations that matters

Phases 1–3 contain **no model calls at all**. That is deliberate. Get the free
mechanical pipeline correct first — every token you spend later is multiplied by
however leaky the filter is. A bad filter is not a small problem you fix later; it
is the entire cost of the system.

## What is explicitly out of scope

- Auth, accounts, multi-tenancy
- Sending email (drafts only — see CLAUDE.md rule 2)
- Scraping behind logins (LinkedIn, Upwork). They're hostile to it and it risks
  Joshua's real accounts. Public sources only.
- A mobile app. The UI is responsive; that's enough.
- Paid data providers.
