# Lead Engine

A personal lead-generation engine for Joshua Senining. Harvests contract and
founder leads nightly, scores them against a fixed profile, and drafts outreach
emails into Gmail for human review.

**It never sends.** There is no send path anywhere in this repo, and that is a
product decision rather than an omission.

**Cost: $0/month.** Vercel Hobby + Neon free + GitHub Actions + Gmail API.

Deployed: `lead-engine-one-beige.vercel.app`

---

## Daily use

```bash
pnpm nightly
```

Harvests every source, then filters and pre-scores. Chained inside the script
because Windows PowerShell has no `&&`. GitHub Actions runs the same thing at
20:00 UTC on weekdays, so this is only needed to pull leads in early.

If it reports `needs_scoring` above zero, run `/daily-run` in Claude Code: it
batch-scores, drafts, verifies, and creates Gmail drafts. Three model calls,
target under 25,000 tokens.

```bash
pnpm review     # reply rates by angle, source, stack and send day
pnpm followups  # what the day-4 / day-11 ladder owes
pnpm tokens     # token spend per run; exits non-zero over 40k
```

---

## Status

All six phases of `docs/00-PLAN.md` are built. The mechanical pipeline runs
nightly and unattended, and every path has been executed at least once against
real infrastructure — including Gmail, via `pnpm gmail:smoke`, which creates a
draft and deletes it again.

What has not happened yet is a real outreach draft: no lead has scored 75 or
above on merit. See `memory/STATE.md` for the current funnel and the open
question that is holding it back.

---

## How it stays cheap

The naive version of this costs 30–60× what it needs to. The saving is
mechanical, not clever prompting — see `docs/05-TOKEN-BUDGET.md`:

- adapters return a ~120-token `NormalisedLead`, never raw HTML or API JSON
- a stable content hash means ~85% of a nightly harvest exits before any work
- hard disqualifiers and a rule-based pre-score are TypeScript, and cost nothing
- only leads that can still reach the threshold after the model's ±15 adjustment
  are sent to it, capped at 25 a night

Phases 1–3 contain no model calls at all.

---

## Layout

```
app/          Next.js routes — inbox, lead detail, follow-ups, weekly review
lib/
  sources/    one adapter per source; the only code that knows about a website
  scoring/    hard disqualifiers and the deterministic pre-score
  model/      Zod contracts for score, draft and verify
  gmail/      drafts.create over plain fetch. No send function.
  db/         Drizzle schema + checked-in, forward-only migrations
scripts/      harvest, prefilter, keepalive, retention, the apply-* pair, tokens
memory/       PROFILE, RUBRIC, STATE, DECISIONS, PATTERNS, OUTREACH-LOG
docs/         specs, read on demand
.claude/      agents, skills and the /daily-run command
```

`CLAUDE.md` is the entry point for Claude Code. `memory/STATE.md` is what to read
first in a new session; `memory/DECISIONS.md` records why things are the way they
are, including the source survey explaining why there is no fourth job board.

---

## Setup

Requires `DATABASE_URL` (Neon, pooled) in `.env.local`, plus the three
`GOOGLE_*` values for Gmail. Copy `.env.example` and fill it in — that file must
never hold a real value, since it is committed.

```bash
pnpm install
pnpm db:migrate
pnpm dev
```

Gmail needs a one-time OAuth grant, `gmail.compose` scope only — it can create
drafts and cannot read the mailbox:

```bash
pnpm gmail:auth
```

The app stays in Google's Testing mode deliberately: publishing would trigger a
verification review a single-user tool does not need. The consequence is that the
refresh token expires every 7 days, so `invalid_grant` means re-run the command
above rather than something being broken.

---

## Definition of done

`pnpm typecheck`, `pnpm test` and `pnpm build` pass, the migration applies to a
fresh database, and `memory/STATE.md` is updated. CI enforces the first three on
every push, and fails if the schema and its migrations have drifted.
