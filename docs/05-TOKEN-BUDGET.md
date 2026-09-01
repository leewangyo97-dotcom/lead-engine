# Token Budget — how this project stays cheap

The naive version of this app costs 30–60× what it needs to. Everything here is
about one idea: **the model should only ever see what requires judgment.**

## The numbers to beat

A single night's harvest is roughly 400 raw listings. Handled naively — feed each
raw listing to a model, one call each — that is ~400 × 4,000 tokens ≈ **1.6M input
tokens per night**. Every night. For maybe 12 leads that matter.

Target: **under 25,000 tokens per night.** That is a ~98% reduction, and it comes
from six mechanical steps, not from prompting tricks.

## The funnel

```
400 raw listings
  │  [code] parse + normalise            0 tokens
  ▼
400 normalised records
  │  [code] content-hash dedupe          0 tokens   ── ~85% are unchanged since
  ▼                                                    yesterday and exit here
 60 new or changed
  │  [code] hard disqualifiers           0 tokens
  ▼
 35 plausible
  │  [code] rule-based pre-score         0 tokens
  ▼
 18 above threshold
  │  [model] batch score, ONE call     ~6,000 tokens
  ▼
  7 scoring ≥ 75
  │  [model] draft emails, ONE call   ~12,000 tokens
  ▼
  7 drafts
  │  [model] verify claims, ONE call   ~4,000 tokens
  ▼
  7 Gmail drafts                       ≈ 22,000 tokens total
```

## The twelve rules

### Rule 1 — The model never sees raw HTML or raw API JSON
Adapters return a `NormalisedLead`: about 120 tokens. A raw HN comment or RemoteOK
record is 2,000–5,000. This single rule is worth more than the other eleven combined.

### Rule 2 — Content-hash everything, skip what hasn't changed
```ts
hash = sha256(`${company}|${title}|${region}|${description.slice(0,500)}`)
```
Store it. On the next run, an identical hash means skip entirely — no scoring, no
re-drafting. Job listings persist for weeks, so this eliminates ~85% of nightly work.

### Rule 3 — Hard filters are code, not judgment
Reject before the model ever sees it: non-engineering titles, regions on the
blocklist, companies already contacted within 90 days, listings older than 45 days,
disqualified stacks (embedded C/C++, Rust systems, ML research). Regex and a
`WHERE` clause. Zero tokens.

### Rule 4 — Two-stage scoring, cheap stage first
Stage 1 is pure TypeScript: keyword weights for stack, region eligibility, contract
flag, direct-inbox flag, pay band. It produces a 0–100 number and costs nothing.
Only rows above threshold (default 55) reach the model. Tune the threshold to keep
stage 2 at 15–25 rows a night.

### Rule 5 — Batch, never loop
One call with 20 leads in a compact table beats 20 calls with one lead each. The
instructions and rubric are sent once instead of twenty times — roughly 70% saved
on overhead alone. Never write `for (lead of leads) { await model(...) }`.

### Rule 6 — Order the prompt for cache hits
Prompt caching rewards a stable prefix. Structure every prompt as:

```
[STABLE, cacheable]  rubric + profile + output schema + examples
[VARIABLE, last]     tonight's leads
```

Never interleave. A profile edit invalidates the cache for that day — batch profile
changes rather than tweaking daily.

### Rule 7 — Project fields, truncate text
Scoring needs `{company, title, region, contract, stack, pay}`. It does not need the
description. Where description is genuinely needed, truncate to 400 characters —
the signal is in the first two sentences.

### Rule 8 — Structured output with a cap
Zod schema in, JSON out, `max_tokens` set deliberately. Scoring output should be
`{id, score, tier, reason}` where `reason` is capped at 120 characters. Prose in a
scoring response is pure waste.

### Rule 9 — Subagents isolate context
`harvester` handling a broken adapter reads a lot of HTML. Run it as a subagent so
that HTML lives and dies in its context, and the main thread receives only
"adapter fixed, 3 selectors updated". Same for `verifier`.

### Rule 10 — Memory files are read selectively and capped
`STATE.md` is capped at 150 lines and read every session — keep it lean.
`DECISIONS.md` is append-only and read **only** when about to contradict something.
`OUTREACH-LOG.md` is queried through SQL, never read whole.

### Rule 11 — CLAUDE.md stays under 200 lines
It is re-read every single session. Every line there is a line you pay for
repeatedly. Detail belongs in `docs/`, loaded on demand.

### Rule 12 — Measure it
`pnpm tokens` prints estimated tokens per stage for the last run, from a
`run_metrics` table. If a night exceeds 40k, something regressed — usually a filter
that stopped filtering. Treat it as a failing test.

## Where Claude actually runs

Per the chosen setup: **Claude Code, locally, on Joshua's machine.** GitHub Actions
does harvest → dedupe → hard filter → pre-score and writes rows to Neon with
`status='needs_scoring'`. No API key, no server-side model calls, no per-token bill.

In the morning Joshua runs `/daily-run`. It pulls only the pre-filtered rows,
batch-scores, drafts, verifies, and writes Gmail drafts. The whole session is
one context, three model calls, ~22k tokens.

If it ever moves server-side, the switch is one adapter in `lib/model/` and the
funnel above is unchanged — which is the point of keeping judgment separate from work.
