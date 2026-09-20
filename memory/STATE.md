# STATE — read this first, every session

**Cap: 150 lines.** When it exceeds that, roll closed items into `DECISIONS.md`
and truncate. This file is read every session; every line costs tokens repeatedly.

Last updated: 2026-09-20 · Phase: **all six built. No success criterion met yet.**

## The honest position

**The machine is built and unproven.** Six phases shipped, both funnels live, 684
tests, nightly green — twelve consecutive runs, weekdays only, checked 20 Sept.
And: **23 sends, zero replies, zero logged outcomes** — counted in the database on 20 Sept, not remembered. Phase 6's
exit test needs 20 *outcomes* before the learning loop can say anything, so
`/review` is not broken — it is unfed, and it now says which condition is unmet
rather than blaming the send count it has already passed. Everything below is
ordered by that.

**Prospect email goes through the Gmail API** as of 11 Sept, and **a draft is not
a send**: the row carries `gmailDraftId` with `sentAt` null, so the follow-up
ladder does not start until a person clicks "I sent it" (`POST
/api/prospects/<id>/sent`). The app holds `gmail.compose` — it can create a draft
and cannot read the mailbox to learn what became of it. `mailto:` is the fallback
when the token dies and **it asks too** — neither email path records a send on a
click, because the token expires weekly and a fallback that auto-recorded was a
back door to the same bug. WhatsApp is unchanged: wa.me opens a page that is
unambiguously the message. Before this, closing a compose window unsent still
marked the prospect contacted and queued a follow-up for a message never sent.

## What is left, in the order it matters

### 1. Outcomes — this is the project

- **The follow-ups are six days overdue.** Due Sunday 13 Sept 19:31 Manila; on
  20 Sept `select step … from outreach` still returns **no row above step 0**, so
  not one has been written. All 23 sends are past rung one and the older ones are
  past rung two. They were dry-run on 11 Sept — **0 verifier violations, 0 over
  length, correct channel** — so nothing is blocking but the clicking. The app
  writes them on the click; `pnpm followups` emits the two leads only.
- **Send the 12 unsent drafts.** Twelve `step = -1` rows, none in Gmail yet.
  Verified 10 Sept; sites change, so re-run `pnpm drafts:verify` first.
- **Check whether the WhatsApp sends delivered.** 6 of 12 went to *guessed*
  numbers outside the Philippines, all Austin. Nothing here knows: the app builds
  a `wa.me` link, a person clicks it, `sentAt` records the click. Only WhatsApp
  has the ticks — one tick means it never arrived. If those six failed the real
  sample is 14, not 20, and "no replies" means much less than it looks. Each has
  a working email; re-sending by mail is the fix.
- **Log every outcome** — `no_reply | reply | call | won`. Zero exist.

### 2. Decisions only Joshua can make

- **Publish the Google OAuth consent screen.** In Testing the refresh token dies
  every 7 days, and now it takes more with it: prospect email falls back to
  `mailto:` when the token is dead, so a weekly expiry silently changes how every
  email prospect is contacted. **The token died again on 20 Sept**
  (`invalid_grant`). Started 12 Sept and stuck: Branding is filled and saved, but
  Audience still reports the configuration incomplete and Publish is unavailable.
  Next thing to check is whether **Data Access** lists `gmail.compose` — an app
  with no scope recorded has nothing to publish.
- **Add the three `GOOGLE_*` variables to Vercel** and redeploy. The deployed app
  has `DATABASE_URL` only, so every email click there uses the fallback.
- **Closed 12 Sept, in DECISIONS:** full-time counts (rubric 1.2.0), and the geo
  funnel stays. Do not reopen either as an implicit assumption.
- **What to do about the lead funnel.** Counting full-time doubled the top of it
  — **6 of 194** clear 75, average 39 — and that is still a funnel where the
  ceiling is stack and timezone, not terms. Those boards do not carry UTC+8 work
  in his stack. Either accept the rate, or stop spending nightly runs on it.

### 3. Code — real, and none of it changes the outcome

- Enrichment backlog **959 rows** at 200/night: about a week, unattended.
- `pnpm lh --limit=N` on rows as enrichment reaches them. **390 measured.** The
  cap is 150 per process and not negotiable — see below. A refusal is now
  recorded under `lighthouseRefused` and skipped for 30 days, so dead sites stop
  filling the front of every batch; `/prospects` shows "site did not load".
- 17 leads now queue for model scoring under rubric 1.2.0 — `pnpm leads:scoring`.

### Deliberately not doing — recorded so it is not re-proposed

Unused JavaScript as a signal (stable, but the theme's doing and invisible to the
owner). Lighthouse in the nightly (42 min against a 15-min budget). Wappalyzer
(no licence on npm). Any send path — CLAUDE.md rule 2.

## Live state

**10,069 prospects** · 2,540 reachable · 33 MB of 512 · 20 hot · 959 awaiting
enrichment · 390 measured by `pnpm lh`. Page weight, low contrast and unsized
images now print under the site link in the `/prospects` SITE column. The
`Australia [schools]` search was deleted 11 Sept: 13,134 rows, 57% of the table,
0 outreach attached, and 6,711 of the then-8,870 backlog. Exported to
`C:\dev\lead-engine-backups` first.

**404 leads** · 178 disqualified · 206 parked · 2 sent · 1 drafted · 17 awaiting
model scoring. Rubric **1.2.0**: full-time counts.

**The repo is public, deliberately.** Private broke CI on 11 Sept — GitHub
billing is failing and a private repo draws metered Actions minutes. Fixing the
billing is the prerequisite for ever going private.

**Access control is closed.** Vercel Authentication, All Deployments — pages
*and* write endpoints 302 to the SSO wall, verified from outside. Nothing
automated calls the deployment.

**Geo discovery is live.** `/prospects` searches OSM, enriches, scores, opens a
pre-filled message; `/prospect-run` is the loop. Nightly enriches 200 and
re-scores; monthly refreshes map data.

Working copy `C:\dev\lead-engine`; `F:\lead-engine` is corrupt, awaiting chkdsk.

## Reminders that bite

- **`pnpm lh` dies after ~188 rows in one process** — `Ineffective mark-compacts
  near heap limit`, with the heap already at 4 GB. Lighthouse does not give its
  memory back. Hence `MAX_PER_PROCESS = 150`; asking for more prints why and
  takes 150. A backlog costs repeated commands, not a bigger number.
- **`--dry` still measures.** It only skips the write. Never run it to check a
  log line — that is 150 third-party servers hit to read a `console.log`.
- **Australian sites refuse from here.** It killed the schools search and it now
  dominates the lh queue: 44 of one 150-row batch, then 9 of the first 11 of the
  next, all `PAGE_HUNG` or `ERRORED_DOCUMENT_REQUEST`. Not a bug at this end.
- **A ladder's labels and its arithmetic are two different things.** `LADDER_DAYS`
  counts from first contact; due-ness counts from the last touch. They were the
  same numbers, so rung 2 ran to day 15 under a label reading "Day 11".
- **A projection is half of every fix.** `chooseChannel` learned to prefer email
  in the US and did nothing, because `prospect-queries.ts` did not select
  `countryCode`. Correct logic, green tests, zero effect. Check the call sites.
- The schedule is written down **four** times — two `cron:` lines and two `if:`
  gates. Its test checked two, and the monthly retention job was silently
  scheduled never to fire again. Now asserted.
- A test that stringifies an object containing a timestamp will fail on the
  millisecond it runs. CI caught one; the local gate never would.
- `refreshProspects({ ids, enrich: true })` must pass those ids to
  `runEnrichment`, or it enriches the global top of the queue instead
- OSM values are normalised at the write path, never stored raw: emails via
  `firstUsableEmail`, social via `normaliseSocial` (`/p/` is a page on Facebook
  and a post on Instagram)
- HTML is parsed with `cheerio`, not regexes — two regexes produced real false
  claims. `.text()` fuses adjacent elements, so `stripTags` joins with a space
- WhatsApp capability needs `libphonenumber-js/max`; and a "likely" number is a
  good guess in the Philippines and a coin toss in the US
- Never suppress a platform domain (`weebly.com`, `wixsite.com`, …)
- `enrichment_status` is the enrichment queue; a `no_website` row must be
  reopened when one appears, or its site is never read
- Overpass 504s several times a day. It is load, not a bug — retry
- Vercel Hobby cron is **once per day, ±59 min** — the scheduler is GitHub Actions
- Vercel Hobby is **non-commercial only**
- Neon autosuspends at 5 min idle; use the HTTP driver
- Phases 1–3 contain **zero** model calls. Keep it that way.
- `contentHash` stability is the single biggest cost lever — its test is not optional
- The preview pane sometimes stops applying streamed updates. Check with curl
  before believing it — see RUNBOOK
- `tokens:record` writes to the **most recent** run and its figures come from a
  person — never paste numbers out of a usage line
- Tailwind's spacing scale is **replaced**, keys 0-12 only. `py-0.5`, `h-14`,
  `py-16` emit nothing and fail silently — use an arbitrary value like `h-[6px]`
