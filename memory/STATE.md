# STATE — read this first, every session

**Cap: 150 lines.** When it exceeds that, roll closed items into `DECISIONS.md`
and truncate. This file is read every session; every line costs tokens repeatedly.

Last updated: 2026-09-11 · Phase: **all six built. No success criterion met yet.**

## The honest position

**The machine is built and unproven.** Six phases shipped, both funnels live, 634
tests, nightly green on 3, 4, 7, 8, 10 and 11 September. And: **20 sends, zero
replies, zero logged outcomes.** Phase 6's exit test needs 20 *outcomes* before
the learning loop can say anything, so `/review` is not broken — it is unfed.
Everything below is ordered by that.

## What is left, in the order it matters

### 1. Outcomes — this is the project

- **Monday 14 September: 18 follow-ups.** 16 prospects + 2 leads (Atria, This Dot
  Labs), all step 1, first due Sunday 13th 19:31 Manila. The 16 were dry-run on
  11 Sept: **0 verifier violations, 0 over length, correct channel**. The app
  writes them on the click. `pnpm followups` emits the two leads only.
- **Send the 17 unsent drafts.** Verified 10 Sept; sites change, so re-run
  `pnpm drafts:verify` first.
- **Check whether the WhatsApp sends delivered.** 6 of 12 went to *guessed*
  numbers outside the Philippines, all Austin. Nothing here knows: the app builds
  a `wa.me` link, a person clicks it, `sentAt` records the click. Only WhatsApp
  has the ticks — one tick means it never arrived. If those six failed the real
  sample is 14, not 20, and "no replies" means much less than it looks. Each has
  a working email; re-sending by mail is the fix.
- **Log every outcome** — `no_reply | reply | call | won`. Zero exist.

### 2. Decisions only Joshua can make

- **Publish the Google OAuth consent screen.** In Testing the refresh token dies
  every 7 days and `pnpm gmail:drafts` dies with it.
- **Full-time or contract?** The resume says full-time remote; the rubric is built
  for contract. `/rejected`: 1 lead qualifies today, 6 would if full-time counted.
- **Is the geo funnel the right business?** Its 17 unsent drafts are Cebu cafes
  and restaurants with no websites — a different trade from contract engineering,
  and where all outreach volume currently goes.
- **What to do about the lead funnel.** Only **3 of 192** scored leads have ever
  cleared 75; the average is 33. Not a filter to tune — those boards do not carry
  UTC+8 work in his stack. Change what qualifies, or stop spending nightly runs
  on it. `pnpm leads:diagnose`; figures in DECISIONS.

### 3. Code — real, and none of it changes the outcome

- Enrichment backlog **2,159 rows** at 200/night: about a fortnight, unattended.
- `pnpm lh --limit=N` on rows as enrichment reaches them. 128 measured so far.
- The contract weight in the rubric, if the answer above is "contract".

### Deliberately not doing — recorded so it is not re-proposed

Unused JavaScript as a signal (stable, but the theme's doing and invisible to the
owner). Lighthouse in the nightly (42 min against a 15-min budget). Wappalyzer
(no licence on npm). Any send path — CLAUDE.md rule 2.

## Live state

**10,069 prospects** · 2,540 reachable · 33 MB of 512 · 20 hot, 250 warm, 9,799
cold · 2,159 awaiting enrichment · 128 measured by `pnpm lh`. The
`Australia [schools]` search was deleted 11 Sept: 13,134 rows, 57% of the table,
0 outreach attached, and 6,711 of the then-8,870 backlog. Exported to
`C:\dev\lead-engine-backups` first.

**364 leads** · 192 scored · 172 disqualified · 188 parked · 2 sent.

**The repo is public, deliberately.** It was made private on 11 Sept and CI broke
that minute: GitHub billing on the account is failing, and a private repo draws
Actions minutes from a billing-backed allowance while public gets unlimited.
Fixing the billing is the prerequisite for ever going private; nothing else
needs it.

**Access control is closed.** Vercel Authentication, All Deployments — pages
*and* write endpoints 302 to the SSO wall, verified from outside. The nightly
never calls the deployment, so nothing automated depends on it.

**Geo discovery is live.** `/prospects` searches OSM by place and category,
enriches, scores, and opens a pre-filled message. `/prospect-run` is the loop.
Nightly enriches 200 and re-scores; monthly refreshes map data.

Working copy `C:\dev\lead-engine`; `F:\lead-engine` is corrupt, awaiting chkdsk.

## Reminders that bite

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
