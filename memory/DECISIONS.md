# DECISIONS — append-only

Do not read this file at session start. Read it when you are about to make a
choice that might contradict one already made. Never edit an entry; supersede it
with a new one that references the old.

Format: `## NNN — Title` / Date / Decision / Why / Consequences / Supersedes.

---

## 001 — GitHub Actions is the scheduler, not Vercel Cron
**2026-09-01**

**Decision:** All scheduled work runs in GitHub Actions. `vercel.json` contains no
`crons` key.

**Why:** Vercel Hobby caps cron at once per day and cannot guarantee timing — a
`0 1 * * *` job fires anywhere in the 1am hour, and any more frequent expression
fails at deploy. Actions gives unlimited minutes on public repos (2,000/month
private) at any interval, for free.

**Consequences:** Secrets exist in two places. Actions needs its own `DATABASE_URL`.
The repo must stay active or GitHub disables scheduled workflows after 60 days —
handled by a keepalive write in the workflow.

---

## 002 — Claude runs locally in Claude Code, not server-side
**2026-09-01**

**Decision:** No Anthropic API key in the system. Actions does mechanical work
only; Joshua runs `/daily-run` in Claude Code for scoring and drafting.

**Why:** Zero marginal cost on an existing subscription. It also keeps a human in
the loop at exactly the point where judgment matters.

**Consequences:** The system is not fully autonomous — leads sit in `needs_scoring`
until he runs the command. Accepted deliberately. If this ever changes, it is one
adapter in `lib/model/`; the funnel is unaffected.

---

## 003 — Drafts only. There is no send path.
**2026-09-01**

**Decision:** The system creates Gmail drafts and stops. The OAuth scope is
`gmail.compose`, which cannot send.

**Why:** Auto-sent cold email is why cold email doesn't work, and it risks
rate-limiting Joshua's personal Gmail. Choosing the narrower scope makes the rule
structural rather than a convention someone later "improves" away.

**Consequences:** Sending is manual, every time. That is the feature.

---

## 004 — Single user. No auth, no `users` table.
**2026-09-01**

**Decision:** One hardcoded user. No accounts, no tenancy, no billing.

**Why:** Vercel Hobby forbids commercial use, so this cannot be a product without a
plan change anyway. Single-user removes an entire category of work.

**Consequences:** Going multi-user later means adding `user_id` throughout and real
auth — a real migration, knowingly deferred.

---

## 005 — Drizzle over Prisma
**2026-09-01**

**Decision:** Drizzle ORM.

**Why:** The schema is one compact file a model can read cheaply every session.
Prisma's generated client is large and its schema verbose, which is a recurring
token cost in a project where a model reads the schema constantly.

**Consequences:** Fewer batteries included. Migrations via drizzle-kit.

---

## 006 — Public sources only
**2026-09-01**

**Decision:** No scraping behind logins — no LinkedIn, no Upwork, no
Work at a Startup.

**Why:** Against their terms, and it puts Joshua's real accounts at risk. The
public sources (HN, RemoteOK, funding wires) already produce more than he can
action in a week.

**Consequences:** Some leads are unreachable by the tool. He can add them by hand.

---

## 00X — pnpm build scripts are approved in `pnpm-workspace.yaml`

**Date:** 2026-09-01

pnpm 11 blocks dependency install scripts by default and exits 1 rather than
warning. The approval key is `allowBuilds` in `pnpm-workspace.yaml` — not
`onlyBuiltDependencies`, and not a `pnpm` field in `package.json`. Both of those
are silently ignored, so the install keeps failing with the same error and it
looks like the allowlist is being disregarded.

`esbuild` is approved because vitest and drizzle-kit both need it to unpack its
platform binary. Nothing else is approved. If a future dependency demands a build
script, read what the script does before adding it here — this is the one place
in the repo where installing a package runs arbitrary code.

---

## 00X — stage 2 is gated at 60 and hard-capped at 25 leads

**Date:** 2026-09-01

Two separate limits, for two separate reasons.

**The gate is 60**, derived rather than chosen: the `needs_draft` threshold is 75
and stage 2 may adjust by at most +/-15, so a lead below 60 cannot reach 75 no
matter how well it reads. Sending it to a model spends tokens on a foregone
conclusion. If either number in `memory/RUBRIC.md` changes, the gate moves with
it — it is computed in `prefilter.ts`, not typed in.

**The cap is 25 leads per run.** Stage-2 cost scales with this number and nothing
else. On a good day the gate may pass 60 candidates, and without a ceiling the
bill triples with no one deciding that it should. Overflow parks and is reported
in the run line, so a capped run is visible rather than silent.

Parked leads still get a `scores` row. Phase 6 needs to be able to ask what the
gate turned away; discarding the evidence would make the rubric untunable.

---

## 00X — the UI uses Ember & Paper tokens, not the palette in 04-UI-SPEC.md

**Date:** 2026-09-01

`docs/04-UI-SPEC.md` specifies ground `#EDF1EF`, Archivo, and semantics
`#17734F` / `#8C5D08` / `#5B6C73`. The Ember & Paper foundations wired in Phase 0
specify `paper/200 #F2F1EA`, Instrument Sans, and `go/500 #2F6B4F`. Both agree on
ember `#C2451F` as the accent.

Ember & Paper wins, because it is the palette that exists in the Figma file and
in `app/globals.css`, and because its contrast pairs were computed rather than
estimated — two of its greys were darkened after measuring. Adopting the spec's
palette would mean redoing that work for values with no source.

Everything else in the UI spec is followed as written: the screen list, the
keyboard model, the row anatomy, and the rule that the left stripe is a severity
encoding.

---

## 00X — the draft screen shows nothing rather than a mock

**Date:** 2026-09-01

`/lead/[id]/draft` exists so the `e` shortcut has somewhere to land, but it
renders an explanation instead of a sample email. A screen showing a plausible
fake draft is the most dangerous thing that could be in this repo: the entire
point of the verifier is that no unverified claim reaches a Gmail draft, and a
mock is an unverified claim rendered convincingly.

---

## 00X — Gmail is reached with fetch, not the googleapis SDK

**Date:** 2026-09-01

Two endpoints are needed: refresh a token, create a draft. `googleapis` is tens
of megabytes and pulls a large transitive tree to provide them. This client holds
a refresh token, so its dependency surface is a thing that has to be trusted —
smaller is the whole argument.

Scope is `gmail.compose` and nothing wider. It can create drafts and cannot read
the mailbox. `lib/gmail/client.ts` has no send function and must not acquire one.

---

## 00X — the promotion threshold lives in code, never in a prompt

**Date:** 2026-09-01

`/daily-run` asks the model for a score and a reason. It does not ask the model
to decide what happens next. `apply-scores.ts` reads `NEEDS_DRAFT_THRESHOLD` and
promotes or parks accordingly.

A threshold stated in a prompt is a threshold that drifts — it gets reworded, or
the model rounds it, and nothing fails. Keeping it in code means changing it is a
diff someone can review.

The same reasoning puts the verified-only Gmail rule in a `WHERE` clause rather
than an `if`: an unverified row is never fetched, so no later edit to that file
can let one through by accident.

---

## 00X — reply rates are withheld below five sends, and suggestions below twenty

**Date:** 2026-09-01

Two replies in three sends is 67%. Displayed as a percentage it looks like a
finding, and it is noise wearing a number — the exact failure the learning loop
exists to avoid, since a tool that launders guesses as measurements is worse than
no tool.

So: a cut below `MIN_SENDS` (5) shows its counts and withholds its rate. A rubric
suggestion needs `MIN_TOTAL_FOR_SUGGESTION` (20) logged sends *and* a gap of 15
percentage points or more between the best and worst angle. Below either bar the
page says why it is silent rather than showing something weak.

Nothing is ever auto-applied. `weekly-review.ts` prints; accepting is a human act
that writes here.

---

## 00X — follow-up due dates are computed, not stored

**Date:** 2026-09-01

A `dueAt` column would have to be rewritten every time an outcome is logged, and
a stale one would queue a follow-up to somebody who already replied — the single
most embarrassing failure this tool could have.

`getDueFollowups` derives it instead, from the last touch and the events table.
A logged reply cancels the ladder by existing, with no cleanup step to forget.

Measured from the *last* touch, not the first: a day-4 note that went out late
must not be followed by the day-11 one the next morning.

---

## 00X — source survey: the free feeds do not carry this work

**Date:** 2026-09-01

Before building a third adapter, each candidate was measured rather than
assumed. Results, all from live requests:

| Source | Finding |
|---|---|
| HN "Who is hiring" (2 threads, 244 comments) | 141 parse to a real role; US full-time skew; 3 reach stage 2, 0 clear 75 |
| RemoteOK API | ~3 engineering roles per 100 items; no contact ever, so capped at 2/10 on that weight |
| HN "Freelancer? Seeking freelancer?" | **1** client post across four months, and it was Vue/Ruby, US+EU only |
| WeWorkRemotely programming RSS | 25 items, 0 contract, 0 mobile; heavy Toptal/Proxify agency presence |
| WWR and RemoteOK contract-only feeds | 301 and 410 — neither exists any more |

The conclusion is not that the filter is too strict. It is that free public job
feeds are dominated by full-time salaried roles, and the rubric weights contract
terms at 20 and direct contact at 10 — 30 of the 100 points describe something
these sources structurally do not have.

**Do not add another job board.** The next source that could change the outcome
is one where the counterparty is a founder rather than an HR pipeline: the
`funding-wire` adapter in the source-adapter contract. That needs rubric weights
for `kind: 'funding'`, which do not exist yet — a funding lead has no title,
region or stack, so the current rubric scores it near zero by construction.

That is a rubric decision for Joshua, not an implementation detail to guess at.

---

## 00X — founder leads get their own rubric dimensions

**Date:** 2026-09-01 · rubric 1.1.0

The source survey established that free job boards carry almost no contract work
with a named human contact — 30 of the job rubric's 100 points describe exactly
what those feeds lack. `launch-hn` harvests the opposite shape: a founder who has
just launched, with a dated trigger and often their own inbox, but no stated
region, terms or pay.

Scored under the job weights, such a lead loses 50 points for things the founder
has not been asked yet. That is measuring our ignorance, not the lead. So
`kind='funding'` is scored on trigger freshness (30), stack (30), direct contact
(25) and stage signal (15).

Timezone and contract are deliberately absent rather than zero: they are the two
things a first email exists to find out.

**These weights are initial and unvalidated.** No founder-outreach outcome data
exists. The Phase 6 loop is what should correct them, and Joshua can revert the
whole branch by deleting `prescoreFunding` — the job path is untouched.

---

## 00X — Launch HN founders are deep-tech, and stage 2 keeps rejecting them

**Date:** 2026-09-01

The first real founder batch scored well deterministically and was rejected by
judgment, every time: GPU VM infrastructure, an insurance brokerage, robotics
data pipelines, a Go video tool. All YC S26, all freshly launched, none with a
consumer app surface.

That is the two-stage design working — code produced 81 for machine0 on a
genuine TypeScript/Postgres stack, and stage 2 took it to 66 because the *work*
is GPU infrastructure, a PROFILE-disqualified domain. But a source whose leads
stage 2 rejects every night is a source that costs tokens to say no.

Watch it for a fortnight before deciding. If founder leads keep reaching stage 2
and keep being parked, the fix is a hard filter on the domain — not a weight
change, because the weights are measuring what they claim to measure.

Do not act on this yet: four rejections is not evidence, and Phase 6's rollup is
the thing designed to answer it.

---

## 00X — the filter is not too strict; the market is onsite

**Date:** 2026-09-02

With September data in, the funnel still produces nothing above 75, so the
obvious suspicion was that the disqualifier over-rejects. Audited rather than
assumed.

Hard rejections: `onsite_no_contract` 33, `disqualified_stack` 7,
`non_engineering_role` 2, `unpaid_or_equity_only` 1, `language_required` 1.

A sample of the largest bucket: Seattle WA, New York NY, Astoria NYC,
NYC (ONSITE), Amsterdam, ONSITE/HYBRID New York 3x/week. Every one genuinely
onsite with no contract option, and unreachable from Manila.

Checked for the failure that would matter — a posting offering remote being
scoped onsite anyway: **zero contradictions across 36 onsite-scoped leads**.

So the rejections are correct and the thin funnel is a fact about these sources,
not a bug in the filter. The remaining constraint is the one that has been open
since the start: 20 points for contract terms against a market advertising
full-time roles. That is a decision about what work Joshua wants, not a
threshold to tune.

## Setup history, rotated out of STATE on 2026-09-09

STATE.md hit its 150-line cap. These are closed and need no re-reading:

- 2026-09-01 — Vercel deploy live, `/api/health` green.
- 2026-09-01 — Neon linked, first migration applied, Neon MCP registered in
  `.mcp.json`, Neon agent skills vendored into `.claude/skills/`.
- 2026-09-01 — Phase 0 skeleton: app shell, Drizzle client, migrate script,
  `runs` table for the Phase 3 keepalive, design-token layer, Vitest wired.
- 2026-09-01 — Spec written: plan, architecture, stack, data model, UI, token
  budget, features, orchestration. Agents, skills and memory bank defined.

## Build history, rotated out of STATE on 2026-09-10

Phase work from 1 September, all closed:

- Phase 1: full schema migrated, `hn-whoishiring` adapter, stack canonicaliser,
  `scripts/harvest.ts`, 10 tests. Second harvest inserts 0 rows.
- Phase 2: `disqualify.ts`, `prescore.ts`, `scripts/prefilter.ts`, 13 tests.
  1 of 24 reaches `needs_scoring`.
- Phase 3: keepalive, report-run and retention scripts; the nightly workflow
  fixed to declare the monthly cron its retention job was gated on. Exit test
  passed on two green scheduled runs.
- Phase 4: inbox, lead detail, draft placeholder, settings; keyboard triage
  j/k/enter/e/a/x/f and the ? overlay.
- Phase 5 plumbing: model contracts, payload emitters, apply scripts, the Gmail
  draft client, `pnpm tokens`.
- Phase 6: outcome logging, weekly rollup with evidence gates, the follow-up
  ladder, /review and /followups.
- Operational hardening: per-source raw counts, the fault/warning split,
  /rejected, fetch timeouts and retries, pagination recovery, a 15s adapter
  timeout, `pnpm gate`, `pnpm log:outreach`.
- `remoteok` adapter added; harvest idempotent across both sources.
- Fixed: BD titles were clearing every hard reject.
- Integration check for the draft/verify/Gmail-gate write path; its guard is
  identity, after two row-count heuristics failed in opposite directions.
- Gmail authorised; token exchange and drafts endpoint verified.
- Runtime docs audited end to end against the schemas and the code.
- F: corrupted; working copy restored to C:\dev\lead-engine.

## Rotated out of STATE on 2026-09-10 (second pass)

- 2026-09-02 — First outreach draft produced unassisted by the scheduled run:
  This Dot Labs, an AI-native consultancy hiring a Senior Android Engineer
  (Kotlin) and a Senior React Native Engineer, remote-first and global. Pre-score
  75, stage 2 took it to 80 on a precise stack match. Sent 9 September to
  jobs@thisdot.co and logged; draft id r1950667528497554225. That closed the last
  open exit test — every phase has evidence behind it.
- 2026-09-09 — The "missed" nightly run of 2 September was never missed. It
  started at 20:24 UTC; the check was made at 04:20 Manila, four minutes earlier
  in UTC, with the local date already rolled over. The cron was moved to 20:17 on
  that false premise — harmless, and now asserted against the workflow file by
  tests/nightly-schedule.test.ts. The weekend false alarm fixed in the same
  session was real.

## Per-search discovery figures, rotated out of STATE on 2026-09-10

| Search | rows | websites | phones | emails |
|---|---|---|---|---|
| Cebu City — vets, clinics, dentists | 151 | 4 | 21 | 8 |
| Austin — contractors, trades, pro services | 108 | 71 | 70 | 18 |
| Sydney — contractors, trades, specialists | 187 | 75 | 64 | 21 |

The country-wide searches that followed on 10 September: Australia
schools 13,134 rows; Australia clinics/veterinary/dentists 6,786; a
twelve-category Cebu City search 2,837 and 261 reachable. (The two Australian
searches were first recorded the wrong way round and corrected against their
search ids the same day; the reachable split of 5,103 and 2,105 was attributed
on that reversed reading and is not re-verified here.) Cebu's
reachability rate stays an order of magnitude below Australia's, which is the
same finding at a hundred times the sample.

## Rotated out of STATE on 2026-09-10 (third pass)

- 2026-09-10 — Placeholder figures from a usage line were recorded as real:
  run_metrics held "18 scored, 7 drafted" for a night when 2 leads survived the
  filter. Row restored to 0/0/null/null; `lib/model/record-guard.ts` now refuses
  a count the run's own funnel cannot support, and the docs carry no example
  numbers.
- 2026-09-10 — Figma screen audit finished, all seventeen frames. The mock's
  numbers contradict each other between sizes (score bands, weights, thresholds,
  source names), so structure comes from it and no figure does.
- 2026-09-10 — Three more dead spacing classes found by measuring elements in
  the browser: `py-0.5` on every count badge and kbd key, `h-1.5` on the lead
  page's overlap dot (0x0 since it was written), `py-16` on the empty inbox.
  `tests/spacing-scale.test.ts` reads the scale out of the config and now
  refuses any class the scale has no key for.
- 2026-09-10 — `/followups` draws the ladder as a track (Sent, Day 4, Day 11)
  from `ladderRungs()`, per Figma 3:1437, instead of printing "step 2".

## Rotated out of STATE on 2026-09-10 (fourth pass)

- `/settings` reports whether Gmail will accept a draft, by refreshing the token.
  The only previous signal was `pnpm gmail:drafts` failing at the end of a run.
- `lib/health.ts` computed the run schedule from `0 20` after the cron moved to
  `17 20`; grace absorbed it so it never showed. `tests/nightly-schedule.test.ts`
  parses the workflow and fails if the two copies drift again.
- A country-wide search queues and nothing drains it. `/prospects` says so with
  `pnpm search:run --drain` to copy, instead of a note that read as "nothing
  happened".

## Rotated out of STATE on 2026-09-10 (fifth pass)

- Enrichment took an arbitrary 25 of 9,156 pending and the monthly refresh an
  arbitrary 200 of 23,203. Enrichment now goes best-scoring first, refresh
  oldest-first, so each budget rotates instead of redrawing the same sample.
- `/review` gained the score distribution (Figma 3:1694) — the only thing on that
  page that can see leads nothing was ever sent to, so a scorer collapsed into one
  band stops looking like silence. Production drew 0 / 6 / 51 / 66 / 49.

## Rotated out of STATE on 2026-09-10 (sixth pass)

- Latency checked at 23k rows: no regression. Pages 0.7-1.4s warm, dominated by
  Neon round trips rather than row counts. The nav badge read 7627 and now caps
  at 999+ with the exact figure in its tooltip. Retention covers leads only —
  prospects grow unbounded, which is fine for years and is written down rather
  than assumed.
- The sidebar icons are the design's own (Icons/inbox 3:306, search 3:310,
  calendar 3:308, list 3:307, settings 3:309), replacing Lucide paths that were a
  different drawing at a heavier stroke. Weekly review has no counterpart in the
  set and says so. The other 34 symbols stay unimported.
