# Architecture

## Shape

Two runtimes, one database, and a deliberate split between mechanical work and
judgment.

```
┌───────────────────────────────────────────────────────────┐
│ GITHUB ACTIONS  (nightly, free, no model)                 │
│                                                           │
│  harvest.ts ──► adapters ──► normalise ──► content-hash   │
│       │                                                   │
│  prefilter.ts ──► disqualify ──► rule pre-score           │
│       │                                                   │
└───────┼───────────────────────────────────────────────────┘
        ▼  writes rows: status = needs_scoring
┌───────────────────────────────────────────────────────────┐
│ NEON POSTGRES  (free, scales to zero)                     │
│  sources · leads · scores · outreach · events · metrics   │
└───────┬───────────────────────────────┬───────────────────┘
        │ reads                         │ reads/writes
        ▼                               ▼
┌────────────────────────┐   ┌──────────────────────────────┐
│ NEXT.JS on VERCEL      │   │ CLAUDE CODE  (local, manual) │
│  inbox · detail        │   │  /daily-run                  │
│  draft review · config │   │   scorer → copywriter →      │
│                        │   │   verifier → Gmail drafts    │
└────────────────────────┘   └──────────────────────────────┘
```

## Why the split

**Actions does what is mechanical.** Fetching, parsing, hashing, filtering — all
deterministic, all free, all repeatable. It runs whether or not anyone is awake.

**Claude Code does what is judgment.** Scoring nuance, writing an email that sounds
like a person, catching a claim that isn't supported by the resume. This runs when
Joshua sits down, on his existing subscription, with no API key and no per-token bill.

**Vercel does what is visual.** It never calls a model and never runs cron. It reads
and writes Postgres. That keeps it inside Hobby limits permanently.

The seam between them is the database and one column: `leads.status`.

## Lead state machine

```
harvested ──► disqualified          (terminal, code decides)
    │
    └──► needs_scoring ──► scored ──► needs_draft ──► drafted
                              │                          │
                              └──► parked (below 75)      ▼
                                                    in_gmail
                                                        │
                                              ┌─────────┴─────────┐
                                              ▼                   ▼
                                          answered            no_reply
                                              │                   │
                                     won │ lost │ call      followup_1 → followup_2 → closed
```

Every transition is logged in `outreach_events` with a timestamp. That table is the
raw material for the learning loop in Phase 6 — without it, the system can never
tell you what actually works.

## Source adapters

Every source implements one interface (full contract in
`.claude/skills/source-adapter/SKILL.md`):

```ts
export interface SourceAdapter {
  id: string
  fetch(since: Date): Promise<RawItem[]>
  normalise(raw: RawItem): NormalisedLead | null
}
```

Adapters are the only place that knows about a specific site. Everything downstream
sees `NormalisedLead` and nothing else. Adding a job board is one file plus one
registry line — no other code changes. When a site's markup shifts, exactly one
adapter breaks and its tests say so.

Launch set: `hn-whoishiring`, `remoteok`, `funding-wire`. Add more only after
Phase 5 works end to end.

## Failure policy

- **One adapter fails →** log it, continue with the rest. A dead source must never
  block the night's run.
- **Neon suspended or over quota →** Actions retries once after 60s, then opens a
  GitHub issue. Do not retry in a loop; you'll burn the quota you're waiting on.
- **Gmail draft creation fails →** the draft body is already stored in `outreach`.
  Nothing is lost; retry is safe and idempotent on `outreach.id`.
- **A model call returns invalid JSON →** Zod rejects it, retry **once** with the
  parse error appended. Fail loudly after that; do not silently drop leads.

## Idempotency

Every write is an upsert keyed on `leads.content_hash` or `outreach.id`. Running
`harvest` five times in a row must produce the same database as running it once.
This is tested in Phase 1 and it is the property that makes every other retry in
this document safe.

## Security

Single user, but still:

- `CRON_SECRET` on any API route Actions can reach; reject without it
- Gmail scope is `gmail.compose` only — structurally cannot send
- Secrets in GitHub Secrets and Vercel env vars, never in the repo
- No PII beyond public job-posting contacts and Joshua's own details
- The Vercel deployment can stay behind Vercel Authentication; it has no public audience
