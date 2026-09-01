# CLAUDE.md — Lead Engine

> Read this file fully. Do not read anything in `docs/` or `memory/` until a task
> requires it. This file is loaded into every session; everything else is on demand.
> **Keep this file under 200 lines.** If it grows, move detail into `docs/` and link.

## What this is

A personal lead-generation engine for one user (Joshua). It harvests contract
and founder leads from public sources every night, scores them against a fixed
profile, and drafts outreach emails into Gmail for human review.

**Single user. No auth. No multi-tenancy. No billing.** If you find yourself
adding a `users` table, stop and re-read this line.

## Non-negotiable rules

1. **Never fabricate a fact about Joshua.** Every claim in a generated email must
   trace to `memory/PROFILE.md`. No invented clients, metrics, years, or titles.
   If a proof point isn't in PROFILE.md, it does not go in the email.
2. **Never send email.** This system writes Gmail *drafts* only. There is no
   send path. Do not add one.
3. **Deterministic code does the bulk work; the model does judgment only.**
   Fetching, parsing, deduping, and hard filtering are TypeScript. If you are
   about to have a model read raw HTML or a 400-row JSON array, you are doing it
   wrong — see `docs/05-TOKEN-BUDGET.md`.
4. **Vercel Hobby is non-commercial only.** This stays a personal tool. Do not
   add anything that looks like a product for sale without moving to Pro first.
5. **Cron does not run on Vercel.** Hobby caps cron at once per day with ±59 min
   drift. The scheduler is GitHub Actions. Do not add `crons` to `vercel.json`.
6. **Migrations are forward-only and checked in.** Never edit a shipped migration.

## Stack (all free tier)

| Layer | Choice | Why |
|---|---|---|
| App | Next.js 15 App Router, TypeScript | Vercel-native, one deploy |
| Host | Vercel Hobby | free, non-commercial |
| DB | Neon Postgres free | 0.5 GB, 100 CU-hrs/mo, scales to zero |
| ORM | Drizzle | schema is one file — cheap for a model to read |
| Scheduler | GitHub Actions | free cron at any interval; Vercel Hobby can't |
| UI | Tailwind + shadcn/ui | no design system to invent |
| Email | Gmail API, `drafts.create` | free, no domain to warm |
| Validation | Zod | doubles as the model's output contract |
| Tests | Vitest | fast, no config |

Full detail and exact quotas: `docs/02-TECH-STACK.md`.

## Repo layout

```
app/                 Next.js routes + UI
lib/
  sources/           one adapter per job board — see skills/source-adapter
  scoring/           deterministic pre-score (no model)
  gmail/             draft creation
  db/                drizzle schema + migrations
scripts/             harvest, prefilter, keepalive, report, retention run nightly;
                     the apply-* pair, gmail:*, refilter, audit:titles are manual
.claude/
  agents/            subagent definitions
  skills/            reusable procedures
  commands/          slash commands
memory/              the memory bank — see below
docs/                specs, read on demand
```

## The memory bank

Six files. Read the one you need, not all six.

| File | When to read | Write policy |
|---|---|---|
| `memory/PROFILE.md` | any scoring or writing task | rarely; only when Joshua says so |
| `memory/RUBRIC.md` | any scoring task | when tuning weights, log why in DECISIONS |
| `memory/STATE.md` | start of any build session | every session end. **Cap 150 lines** |
| `memory/DECISIONS.md` | when a choice contradicts one you're about to make | append-only, never edit |
| `memory/PATTERNS.md` | before writing new code | when a convention emerges |
| `memory/OUTREACH-LOG.md` | when scoring or reviewing results | after every drafted/sent email |

**Rotation:** when `STATE.md` exceeds 150 lines, summarise the closed items into
`DECISIONS.md` and truncate. Never let it grow unbounded — it is read every session.

## Agents

Delegate to these rather than doing the work inline. Each runs in its own context,
so raw source data never enters the main thread.

- `harvester` — add or repair a source adapter
- `scorer` — batch-score pre-filtered leads
- `copywriter` — draft outreach emails
- `verifier` — adversarially check claims, links and regions before anything ships
- `shipper` — typecheck, test, migrate, deploy

## Skills

- `lead-scoring` — the rubric and how to apply it
- `outreach-writing` — voice, structure, proof-match, hard rules
- `source-adapter` — the contract every source implements
- `token-discipline` — read this before any task that touches many rows
- `memory-bank` — how to read and write memory correctly

## Definition of done

A change is done when: `pnpm typecheck` passes, `pnpm test` passes, the migration
applies cleanly to a fresh DB, `memory/STATE.md` is updated, and — if it touched
email generation — `verifier` has approved the output.

## Where to start

New session with no context: read `memory/STATE.md`, then `docs/00-PLAN.md`.
