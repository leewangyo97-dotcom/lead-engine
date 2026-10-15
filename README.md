# Lead Engine

A personal lead-generation engine for Joshua Senining. Harvests contract and
founder leads nightly, scores them against a fixed profile, and drafts outreach
emails into Gmail for human review.

**It never sends.** There is no send path anywhere in this repo, and that is a
product decision rather than an omission.

**Cost: $0/month.** Vercel Hobby + Neon free + GitHub Actions + Gmail API.

Deployed on Vercel behind Vercel Authentication — the URL is in the project
dashboard rather than here, because publishing it is the only way anyone finds it.

---

## Daily use

```bash
pnpm nightly
```

Harvests every source, then filters and pre-scores. Chained inside the script
because Windows PowerShell has no `&&`. GitHub Actions runs the same thing at
20:17 UTC on weekdays, so this is only needed to pull leads in early.

If it reports `needs_scoring` above zero, run `/daily-run` in Claude Code: it
batch-scores, drafts, verifies, and creates Gmail drafts. Three model calls,
target under 25,000 tokens.

```bash
pnpm review     # reply rates by angle, source, stack and send day
pnpm followups  # what the day-4 / day-11 ladder owes
pnpm tokens     # token spend per run; exits non-zero over 40k
```

The Inbox opens with "Waiting on you": follow-ups due, emails opened but never
marked sent, messages waiting for an answer, and setup still missing, each with
a link to where it is done.

Follow-ups that are due wait on `/followups`; "Start sweep" shows them one at a
time with the same send buttons as `/prospects`, which write the right
follow-up text themselves.

When anyone answers, mark it on `/replies`: every business messaged, oldest
first, with a link that opens the Gmail search or the WhatsApp chat where an
answer would be. The app cannot read either, so `/review` learns only from
what is marked there.

---

## When something breaks

`docs/08-RUNBOOK.md` covers every fault the system raises, what it means, and
whether it needs you. Short version: a failed source is almost always a transient
upstream error and the next run recovers, because the content hash re-collects
whatever was missed. Gmail's `invalid_grant` means the 7-day Testing-mode token
expired — re-run `pnpm gmail:auth`.

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
  people/     decision-maker discovery: providers, guardrails, scoring, jobs
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

## Decision-makers (`/people`)

Finds the founders, owners and directors behind companies already in the
system (local businesses from `/prospects`, companies from job leads) or one
domain typed in. Discovery runs as a job on GitHub Actions (`discover.yml`);
the page polls it and fills in as it goes. On weeknights at 20:47 UTC (04:47
Manila), after the nightly has scored prospects, it also takes the next 25
local businesses by score that have a website and have not been discovered. Without `GITHUB_DISPATCH_TOKEN` the
job waits for `pnpm people:discover --queued`.

Rules it keeps, all in code:

- **Public business pages only.** robots.txt is honoured, one request a second
  per host, pages cached for the run. LinkedIn is never fetched; a LinkedIn link
  is kept only when the company's own site publishes it.
- **Business contact details only.** Free mailboxes (gmail.com and the like)
  are dropped, and so are public bodies (.gov, .edu, NHS, k12).
- **Every fact has a source** in `people_sources`: field, value, page,
  provider, date. The detail drawer shows them.
- **A guessed email is research only.** It is shown, never copied, exported
  or sent.
- **Do not contact** puts the address on the shared suppression list, which
  the export and every outreach path check first. **Delete** erases the person
  and their sources; discovery can find them again, so use Do not contact to
  keep someone out.
- People never contacted are deleted after 12 months (`pnpm retention`, nightly).
- **Country and Category chips** narrow the table, and "From local businesses"
  then discovers only that country or category.
- **Copy email** on a person at a local business writes to that person: their
  name in the greeting, their own address when verified, the business's
  otherwise. A business already emailed gets its next follow-up instead, to
  wherever the first email went; the panel says so.
- **Enhance and Make demo** act on the person's business, as on `/prospects`.
  A demo is a one-page site for a business with none, so for businesses found
  here (all have a site) the row says why there is no demo instead.
- **Emails to local businesses greet the owner** found here ("Hi Matt,"), and go to
  the owner's own address when they published one; follow-ups stay with the
  first address (`lib/places/recipient.ts`).

### Providers

| Provider | Adds | Needs |
|---|---|---|
| `website` | people from team, about and leadership pages; company emails and phones; site signals | nothing |
| `edgar` | officers and directors from SEC Form D filings, industry, recent funding (US only) | `SEC_USER_AGENT` |
| `github` | company signals only: org, tech stack, recent activity. Never people: GitHub's terms forbid using profile data for unsolicited email | `GITHUB_TOKEN` |
| `email_pattern` | one guessed address per person, learnt from verified addresses on the same domain, after an MX check | nothing |

### Adding a provider

1. Create `lib/people/providers/<name>.ts` exporting a `PeopleProvider`
   (see `lib/people/providers/types.ts`):
   - `name` is also the `sourceType` written to `people_sources`. Add it to the
     `SourceType` union and to `SOURCE_LABEL` in `app/components/person-drawer.tsx`.
   - `disabledReason(company, env)` returns a sentence when it cannot run
     (missing key, wrong country) and `null` when it can. A disabled provider
     is skipped, not failed.
   - `run(company, soFar, ctx)` returns `Findings`. Fetch only through
     `ctx.fetchText`, which brings robots.txt, the rate limit, the cache, a
     timeout and a size cap. Every `Fact` carries its `sourceUrl`. `soFar` is
     what earlier providers found.
2. Add it to `PROVIDERS` in `lib/people/providers/index.ts`. Order matters:
   providers that find people run before `email_pattern`, which guesses from them.
3. Read keys from `ctx.env`, never from code. Add each one blank to
   `.env.example`, and as a secret to `.github/workflows/discover.yml`.
4. Test the parsing against a saved page in `lib/people/providers/providers.test.ts`;
   tests never touch the network. Whatever a provider returns,
   `applyGuardrails` (`lib/people/merge.ts`) still drops non-decision-makers,
   free mailboxes and anything on the suppression list.

### Environment variables

| Variable | Set in | For |
|---|---|---|
| `GITHUB_DISPATCH_TOKEN` | `.env.local`, Vercel | the site starting `discover.yml`, `enhance.yml` and `search-run.yml`. Fine-grained, this repository only, Actions: read and write |
| `GITHUB_TOKEN` | nothing: Actions provides it | the `github` provider. Put one in `.env.local` only to run it locally |
| `SEC_USER_AGENT` | repository secret, `.env.local` | the `edgar` provider. SEC asks automated clients to name themselves, e.g. `Lead Engine you@example.com` |

---

## Setup

`pnpm setup:check` checks every piece of setup (database, Gmail, the GitHub
token the buttons use, the repository secrets) and prints the command that
fixes each gap; it never prints a value.

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

## Integration check

Unit tests cover pure logic; the write path needs a database, and CI deliberately
has none. Run it against a scratch Neon branch, which is disposable because it is
a copy:

```bash
neon branches create --name integration --project-id <id>
INTEGRATION_DATABASE_URL=$(neon connection-string integration --project-id <id> --pooled --database-name neondb) pnpm test:integration
neon branches delete integration --project-id <id>
```

It truncates tables, so it refuses to run against the database in `DATABASE_URL`.
It spawns the real scripts rather than reimplementing them.

`pnpm test:owners` does the same for owner addressing on `/prospects`
(`scripts/owner-check.ts`): who an email goes to, its greeting, follow-ups,
"Not interested", deletion, WhatsApp-first sequences and mistyped addresses,
through the real code. It adds and removes its own rows and creates no Gmail
draft. Same scratch-branch rule, with `INTEGRATION_DATABASE_URL`.

## Definition of done

`pnpm typecheck`, `pnpm test` and `pnpm build` pass, the migration applies to a
fresh database, and `memory/STATE.md` is updated. CI enforces the first three on
every push, and fails if the schema and its migrations have drifted.
