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

## Rotated out of STATE on 2026-09-10 (seventh pass)

- 95 prospect rows share a phone with another business (twelve preschools on one
  council switchboard). The queue served them as separate work — twelve messages
  to one number — and now keeps the best row per number. OSM emails were also
  stored unvalidated, so a no-TLD address and a `;`-separated pair both got in;
  discovery runs `firstUsableEmail` now and both rows were corrected.
- `search:run --drain` died with "Maximum call stack size exceeded": one INSERT
  of tens of thousands of rows, which Drizzle cannot build (it merges SQL
  fragments recursively) and Postgres would refuse at 65,535 bind parameters.
  `persist` writes in batches of 500 (`lib/chunk.ts`). A city search with 12
  categories had failed the same way with a different message. The drain names
  each search before starting it and no longer strands the queue on one failure.

## Rotated out of STATE on 2026-09-10 (eighth pass)

- A search's page showed its first 200 rows and offered no way to the rest —
  12,934 of 13,134 unreachable. Prev/next paging added, and the sort now ends in
  the row id: score, reachability and name tie in bulk (20 Greencross Vets
  branches), so an offset without a unique key skips and repeats rows. Verified
  with a window function: zero row ids appear on two pages.
- The `/prospects` queue filters by category and city, chips with counts, both
  combinable and each clearable. `addr:city` is set on 217 of 20,107 Australian
  rows because OSM names a suburb there, so `localityOf` falls back through
  suburb/town/village/municipality/hamlet. Rows already stored fill in as
  `prospects:refresh` reaches them, 200 a month.

## 2026-09-10 — Source survey: Remotive and Himalayas. Neither built.

`pnpm leads:diagnose` showed the job funnel needs a source carrying UTC+8-eligible
work in the mobile stack. Following the `source-adapter` rule — measure before
building — two candidates were surveyed with four API calls total. Neither
adapter was written.

**Remotive: ruled out without a survey.** `remotive.com/robots.txt` is behind a
Cloudflare managed challenge, so the crawl rules cannot even be read without
solving a JavaScript bot check. Rule 8 requires respecting robots.txt, and
working around bot protection to harvest a site is not something this project
will do.

**Himalayas: surveyed, does not carry the work.** Public API at
`himalayas.app/jobs/api`, robots allows it, no login. Of 43 unique jobs across
two pages:

| | count | share |
|---|---|---|
| eligible for UTC+8 | 2 | 5% |
| in his stack | 1 | 2% |
| contract | 8 | 19% |
| **eligible and in stack** | **0** | **0%** |

The two UTC+8-eligible postings were a Cyber Security Analyst and a Technical
Mentor. 21 of 43 were United States only.

Two operational notes for anyone who revisits it. The endpoint returns 20 items
per call whatever `limit` says, and `category` is ignored — the same 20 come back
with a sales and operations mix — so harvesting means cursor paging and
client-side filtering, roughly 25 calls for 500 jobs. And it is the only source
seen so far that publishes `timezoneRestrictions` as numeric UTC offsets, which
is exactly the field the rubric's largest dimension needs. That is worth
remembering if their catalogue ever changes; the data model is right and the
inventory is wrong.

**The finding underneath both surveys.** WeWorkRemotely was killed earlier on 25
items (zero contract, zero mobile). Himalayas now on 43 (zero eligible-and-in-
stack). Two independent general remote boards, both near zero. The reasonable
reading is not "try a third board" — it is that general remote job boards do not
carry UTC+8-eligible mobile contract work in any quantity, and the job funnel
will stay near zero however many of them are added. The prospect funnel, where
23,203 businesses are reachable directly, is where the addressable market
actually is.

Sample sizes are small and stated as such. 43 items settles "is this obviously
worth building", not "is this definitely worthless".

## Rotated out of STATE on 2026-09-10 (ninth pass)

- `app/robots.ts` and a noindex were added: the public deployment was crawlable
  and renders other people's phone numbers and email addresses. It stops indexing,
  not access — the access question is still open, see RUNBOOK.
- "They said no" was the only one-way door; declined rows now carry an undo. It
  releases an identifier only when no other still-declined prospect owns it — 95
  rows share a phone, so a blind delete would let businesses that genuinely
  refused back into the queue. Verified on the real council switchboard: undo A
  released 0 and kept 2, undo B released 2.

- `pnpm tokens:estimate` sizes the four real model payloads without a model, so
  the 25k target is checkable at any time rather than only after someone records
  a run by hand. `pnpm tokens` still reads "(not measured)".
- The prospect Email button logged a send and then deleted its own row: logging
  sets the prospect to `contacted` and the top-25 queue lists only `new`, so
  `router.refresh()` unmounted the fallback address. Nothing opened, nothing
  showed, prospect spent. Email holds the row open with a real mailto anchor
  until dismissed; guarded by `tests/prospect-contact-source.test.ts`.

## Rotated out of STATE on 2026-09-10 (tenth pass)

- 2026-09-10 — `pnpm leads:diagnose` added: aggregates the score parts the lead
  page computes one at a time, so an empty inbox can be told apart from a broken
  filter. Rubric maxima moved out of the lead page into `prescore.ts` — they were
  a second copy.
- 2026-09-10 — Figma second pass: the lead header now carries the design's
  ScoreMeter (3:1048 / 3:1973), which the page had never shown above the fold.
  The four 360px frames are audited and the mobile bottom nav is recorded as
  deliberate divergence — the nav is six items now, not the design's four.


## Rotated out of STATE on 2026-09-10 (eleventh pass)


## Rotated out of STATE on 2026-09-10 (final pass)


## Rotated out of STATE on 2026-09-11

## The lead funnel is supply-starved, and now says so

`pnpm leads:diagnose` (new). Over 345 leads: the average job lead scores **33 of
100** against a threshold of 75. 162 of 322 score **zero** on timezone
eligibility and 147 score zero on stack. Not a broken filter — the sources carry
work that is not open to UTC+8, in stacks that are not his.

Surveyed two boards on 10 September and built neither (see DECISIONS): Remotive
sits behind a Cloudflare bot challenge so its robots.txt cannot be read;
Himalayas carries 0 of 43 jobs that are both UTC+8-eligible and in his stack.
With WeWorkRemotely killed earlier on the same test, the reading is that general
remote boards do not carry this work — not that a third board is needed.

**No single fix clears it.** Projected to full marks: timezone 56, stack 49,
contract 47. The 21 leads already scoring full timezone average 57, with stack
8.0/25. So a new source has to carry APAC-friendly roles *in his stack*, not just
APAC-friendly roles — corrected from my first reading, which named timezone alone.
119 of 322 postings are also over 30 days old. All 23 funding leads score 15/15
on `pay`, which ranks nothing.


## Lighthouse is on-demand, and its score is never stored (11 September)

Measured before deciding, against five real prospect sites. **12.6s per site on
the mobile preset, 13.8s on desktop** — the cost is page load plus the audit
suite, so the lighter preset buys nothing. Two hundred sites is 42 minutes
against a fifteen-minute nightly budget that enrichment already takes four of.
So `pnpm lh <prospectId>` runs one site at a time, by hand, and is deliberately
absent from `nightly.yml`.

**The headline number did not survive the measurement.** Same site, three
consecutive runs, one browser:

    The Roofing Guy        perf 55, 58, 58   LCP 6.0s, 5.8s, 5.7s
    Lynnette Chu, D.M.D.   perf 48, 56, 52   LCP 5.0s, 8.2s, 8.3s

Eight points and 3.3 seconds of LCP untouched, and fifteen points for that
dentist between two sessions an hour apart. Two drafts have already gone out
with false claims about a prospect's website; a Lighthouse score in a message
would be the same failure with better branding. `message-verify` therefore has a
`never` rule for it — there is no state of the record that makes the sentence
safe, so it is not gated on a signal.

**The allow-list is the mechanism.** Diffing every audit across two runs:
first-contentful-paint, largest-contentful-paint, speed-index,
total-blocking-time, interactive, unused-css-rules and image-delivery-insight
moved; total-byte-weight (10,475 KiB both runs, byte for byte), unsized-images,
color-contrast, link-name, unminified-css and unused-javascript did not. Audits
describing the page hold, audits describing the clock do not, and only the first
kind is read — by allow-list, so a new Lighthouse version adding a timing audit
has to be opted in rather than noticed later.

**One bug worth recording.** The byte-efficiency audits carry `numericUnit:
"millisecond"`. `unused-javascript` reported `numericValue: 150` on a page whose
display value said "Est savings of 24 KiB" — reading `numericValue` as bytes
would have stored a modelled *timing* estimate in a field promising only
what survives two runs. The bytes are in `details.overallSavingsBytes`.

**What justifies the dependency at all:** the roofer whose homepage pulls 10.5 MB
was on file as `{noHttps: false, noViewport: false, hasBookingForm: true}`. The
HTML enricher never fetches subresources, so page weight is the one measurement
the rest of the pipeline cannot take. At or above 3 MB — a judgement, not a
measurement; the median page is around 2.5 MB — it becomes a `page_weight`
signal, dated, and `message-verify` rejects any megabyte or slow-loading claim
made without it.

## Contrast is a signal; unused JavaScript is not (11 September)

The eleven drafted prospects with websites were all measured. **None crossed the
3 MB weight floor** — the largest was Dresden Vision at 2,371 KiB — so
`page_weight` fired on zero of them. The Roofing Guy at 10.5 MB is an outlier and
is not drafted. The floor was not lowered to make the feature look useful:
telling someone their median-weight page is heavy is the same fabricated
precision the score rule exists to stop.

**Contrast is what that batch actually produced.** Counts: 49, 40, 16, 8, 7, 1, 1
and four zeroes. The floor is ten, which sits in the gap and separates a palette
built on colours that fail from a single muted caption. Three of eleven qualify.

**Checked before building on it.** The allow-list had been justified by two runs
agreeing on audit *scores*, and `color-contrast` scores 0 whether one element
fails or fifty — so an equal score proved nothing about the number a message
would quote. Three consecutive runs of three sites: 49, 49, 49 / 40, 40, 40 /
16, 16, 16. Solid. But mobile against desktop gave Alta Roofing **40 and 39**, so
the count is not quite viewport-independent and the fact names the rendering it
came from.

**A contrast measurement does not license a phone-usability claim.** The existing
viewport rule blocks "hard to use on a phone" and still does, with contrast
measured or not — forty unreadable elements do not establish that. "At phone
width" is the wording the signal supplies and passes both rules; "on a phone"
does not, and that conservatism is deliberate. Dry-run: the new rule fires on 0
of the 33 existing drafts.

**Unused JavaScript was rejected as a signal** despite being stable and large on
all eleven (94 KB to 773 KB). It is the theme's doing rather than a choice the
owner made, and it is not something they can see on their own site — which makes
it a true fact that opens no conversation. Stored, not offered.

## Unsized images is the third signal, at five (11 September)

Counts across the same eleven: 26, 10, 2, 1, 1 and six zeroes. The floor is five,
above anything a header accounts for — Efficent AC's two are the same
`logo-color.svg` twice, which is what the low counts generally are.

**Steadier than contrast, and for a reason.** This audit asks whether the markup
sets width and height, which no viewport changes. Three phone-width runs plus a
desktop run: 26/26/26/26, 10/10/10/10, 2/2/2/2. Contrast needed its fact to name
the rendering because it read 40 at phone width and 39 on desktop; this one does
not, and the test asserts the word "phone" is absent from the fact.

**The fact states the cause, not a measured shift.** Lighthouse's layout-shift
metric is one of the volatile ones and is not stored. What is stored is the
cause — no width or height — and the consequence follows from it: the browser
reserves no space for an image whose size it does not know, so the content below
moves when it loads.

**The rule needs a subject.** "Jump" on its own is how every draft offers a
conversation; "happy to jump on a call" is already in them. So the pattern fires
only when the page, the content, the text or the images are the thing said to
move. Dry run over all 33 drafts: 0 firings, and the signal is offered on two —
Fixorvo AC Repair 26 and Lynnette Chu 10. Fixorvo is the only prospect carrying
both this and contrast.

## The drafted eleven were an unrepresentative sample (11 September)

`pnpm lh --limit=103` finished the enriched set: **128 rows measured, 9 refused,
0 disallowed by robots.txt.** Refusals were `CHROME_INTERSTITIAL_ERROR`,
`ERRORED_DOCUMENT_REQUEST` and one `NO_FCP` — all pages that would not load, none
stored, which is the guard working rather than failing.

**63% carry at least one signal**, against 0 of 11 on the drafted list:

    page_weight    >= 3 MB : 58
    contrast       >= 10   : 29
    unsized_images >= 5    : 30
    at least one           : 80 of 126

The conclusion drawn this morning — that the weight floor earns nothing and the
outlier was the roofer at 10.5 MB — was drawn from eleven Austin trades and one
Cebu dentist. The full set has five pages above 18 MB, topping out at **40,391
KiB** for an early learning centre. Page weight is the most common signal of the
three, not the rarest.

Worth recording as a method note rather than a finding about websites: eleven
rows all drafted in the same week from two cities is not a sample, and a floor
should not be judged against one. The floors were left where they are, which the
larger set supports.

**Two rows came back stale** — measured, then enrichment moved the website — and
`needsMeasuring` puts those first in the next batch rather than leaving a reading
that describes a server the business no longer uses.

## The deployment is no longer public (11 September)

Vercel Authentication, Require Log In, scope **All Deployments**. Verified from
outside the account: `/`, `/prospects`, `/api/health` and
`POST /api/prospects/<id>/contact` all answer 302 to `vercel.com/sso-api`, so the
mutating endpoints are behind it and not only the pages.

Checked before recommending it that nothing automated would break: the nightly
workflow runs scripts against Neon directly and never calls the deployment, so
the only consumer of that URL is a browser. Zero code, no users table, which
leaves CLAUDE.md's "no auth" rule intact — that rule is about not building an
auth system, not about leaving write endpoints open to the internet. The two had
been conflated since the first deploy.

Open from 10 September, closed 11 September. `README.md:12` still publishes the
URL; it now leads to a login wall rather than a contact directory.

## The Australia schools search is deleted (11 September)

13,134 rows, 57% of the prospects table. Exported first; 0 outreach rows were
attached, so no written work was lost.

**What forced the decision was a failure investigation, not tidiness.** The
nightly of 11 September enriched 200 rows and 94 failed — 47%. The cause was not
in `enrich.ts`: NSW and Victorian school sites refuse TCP connections from
outside Australia. Not a 403, not a bot filter, the connection never establishes.

    curl: (7)  Failed to connect to www.adelong-p.schools.nsw.edu.au port 443
    curl: (28) Failed to connect to www.academy.vic.edu.au port 443 after 21043 ms

DNS resolves — `pwsview.wip.det.nsw.edu.au`, 153.107.134.76, NSW Dept of
Education — and connecting to that raw IP fails identically, from this machine
and from GitHub's runners. `education.nsw.gov.au` answers 200, so the
department's public site is reachable while the per-school hosts are not. Those
rows were unreachable from anywhere this code will ever run.

**106 of 155 all-time fetch failures were that one search.** The other funnels
were always healthy: Australia clinics 3 failures in 6,786, Sydney 9 in 187. The
47% was an artefact of a score-ordered queue grinding through schools, which also
makes the "~80 nights" backlog estimate from that run wrong.

    before  23,203 prospects · 8,870 pending · 155 fetch_failed
    after   10,069 prospects · 2,159 pending ·  49 fetch_failed

Schools were 6,711 of the 8,870 pending — 76% of the backlog. Enrichment is now
a fortnight of nights rather than months.

They were never in the target set either: government schools do not hire a
freelance developer, the department runs their sites, and 2,914 harvested email
addresses were school offices there is no reason to contact.

## Rotated out of STATE on 2026-09-11 (evening)

STATE was rewritten around what is left rather than what happened. Closed items
removed from it, kept here.

**The seventeen enhanced drafts.** Written 10 September, the first run of the
enhance loop — every prospect message sent before it was `firstMessage()` with
the name swapped. Per-business, built only from recorded facts. Two of nineteen
were deleted as false, both caught by opening the site: CDW Studios (signals
measured on a 52-byte 403, so `looksLikePage` now requires markup) and Leura
Wellness (told they had no website; theirs is at leurawellness.com.au, so
`ownDomainFromEmail` withholds `no_website` when the domain resembles the name).
The remaining seventeen: zero verifier violations, OSM re-read confirming no
website for any, sixteen on free providers. All came back `unverifiable` — free
email providers, no domain to probe — so the wording changed instead: "you don't
have a website" became "I couldn't find a website for you", a fact about the
search rather than a claim about them. `pnpm drafts:verify` is the standing rule.

**The follow-up ladder gained messages of its own** on 11 September. Until then a
prospect reaching day four would have received their opening message again, word
for word, from someone who had already ignored it once.

**Closed 11 September and no longer tracked in STATE:** access control on the
deployment; the repo visibility question (public, and why); the deployment URL in
the README; `pnpm/action-setup` on a deprecated Node 20; the monthly retention
job's dead gate; the flaky timestamp test; the Australia schools search; and the
Philippines assumptions in `chooseChannel` and `SHOWS`. Each has its own entry
above.

**The count that matters did not move all day.** 20 sends, 0 replies, 0 logged
outcomes — unchanged from the morning, across eleven commits. Worth stating
plainly in the record: the day's work was all machine, and the machine was
already built.

## A draft is not a send (11 September)

Prospect email now goes through the Gmail API rather than a `mailto:` link, and
the reason is not convenience.

The old button handed the browser a `mailto:` and stamped `sentAt` in the same
breath. The browser reports nothing when no mail client is registered, so the
message could silently never be written. And `sentAt` on a click meant a prospect
whose compose window was closed unsent still dropped out of the queue, still
counted toward "20 sends, no replies", and would have come due on the ladder for
a follow-up referring to a message they never received.

The row now carries `gmailDraftId` and no `sentAt`. The ladder starts when a
person says the draft went out — `POST /api/prospects/<id>/sent`, offered as "I
sent it — start the follow-up clock". The app cannot observe this itself: the
scope is `gmail.compose`, which creates drafts and cannot read the mailbox, and
widening it to find out would be a worse trade than asking.

`mailto:` stays as the fallback, because the consent screen is in Testing and the
refresh token dies weekly. It keeps the old meaning deliberately: there is no
draft to track and nothing here will ever see the send, so recording it is the
only honest option. The panel says which of the two happened.

`contactOutcome(channel, draftedInGmail)` is extracted and tested because it is
the whole rule and was previously a conditional buried inside an insert.

One existing test failed on the edit and was worth reading rather than deleting:
it pinned that `router.refresh()` runs only on dismissal, because an earlier bug
refreshed too early and unmounted the row before the fallback address could be
read. The property still held; the regex was adjacency-strict.
