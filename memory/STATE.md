# STATE — read this first, every session

**Cap: 150 lines.** When it exceeds that, roll closed items into `DECISIONS.md`
and truncate. This file is read every session; every line costs tokens repeatedly.

Last updated: 2026-09-10 · Phase: **all six complete, plus geo prospect discovery.**

## Right now

**The machine ran unattended for a week and nothing broke.** Nightly runs on 3,
4, 7 and 8 September all green; weekends correctly skipped. 341 leads, 44
harvested in the last six days, 396 tests passing. Prospect counts are below —
they moved by two orders of magnitude on 10 September.

**Fifteen sends, no replies yet.** Two leads by email (This Dot Labs, Atria) and
thirteen prospects by WhatsApp and email, all on Wednesday 9 September, one row
per prospect — the reopen window is holding, no click storm this time. The
ladder is armed for the first time: day 4 comes due 13 September. `/review`
wants 20 sends before it will call a difference real, so it is close.

Two live chores: the Gmail refresh token expires seven days after each
`pnpm gmail:auth` while the consent screen is in Testing (it expired 8
September — publishing the app ends the chore), and searches are manual, so
prospect supply only grows when someone runs `pnpm search:run`.

**23,203 prospects after the first country-wide searches** (Australia clinics/
vet/dentists 13,134; Australia schools 6,786; a 12-category Cebu City search
2,837). 7,643 reachable, 21 MB of a 512 MB database. All scored: 72 hot, 1,201
warm, 21,930 cold. **9,156 are queued for enrichment and the nightly takes 25** —
a year of nights, so the queue is now ordered by score. Deleting the schools
search is a reasonable call; see RUNBOOK "After a country-wide search".

**Geo prospect discovery is live in production.** `/prospects` searches
OpenStreetMap by place and category, enriches websites, scores, and opens a
pre-filled WhatsApp or email message. First real search (Cebu City — veterinary,
clinics, dentists) found 151 businesses: 23 reachable, 4 with a website, 3
enriched, 1 refused by its own robots.txt.

Two markets, measured, and they behave nothing alike: in the Philippines almost
nobody has a website (4 in 151 Cebu rows), so WhatsApp is the only channel that
reaches anyone and site-health scoring is inert. Abroad the opposite holds — 71
of 108 Austin rows had one, enrichment pulled real addresses off them, and the
pitch has something to point at. `chooseChannel` picks per prospect for exactly
this reason. Full per-search figures are in DECISIONS.

Commands: `pnpm search:run "<place>" <categories>` · `pnpm enrich` ·
`pnpm prospects:score` · `pnpm prospects:refresh` · `pnpm prospects:enhance` →
Claude Code → `pnpm apply:enhance`. The nightly job now enriches (bounded at 25)
and re-scores; the monthly job refreshes map data.



The working copy is `C:\dev\lead-engine`. `F:\lead-engine` is corrupted NTFS
wreckage awaiting `chkdsk F: /f /r`.

## Next three actions

1. **Publish the Google OAuth consent screen.** While it is in Testing the
   refresh token dies every seven days and `pnpm gmail:drafts` stops with it.
2. **Work the day-4 follow-ups on 13 September.** Five sends come due at once.
   `/daily-run` writes them in one batched call; each item must carry its
   `"step"`, because `apply:drafts` refuses a rung that is out of order.
3. The contract weight is still open, but less urgently: a full-time posting just
   cleared 75 on stack merit alone. `/rejected` still quantifies the cost —
   1 qualifies today, 6 would if full-time counted as acceptable terms.

## Blocked

Nothing.

## Open questions for Joshua

- Public or private GitHub repo? Public = unlimited Actions minutes; private =
  2,000/month, which is still plenty. Public also means the code is visible —
  fine, since no secrets are in it, and it doubles as a portfolio piece.
- Resume says "seeking full-time remote"; the tool is built for contract. Which is it?

## Recently done

- 2026-09-10 — Latency checked at 23k rows and there is no regression: pages are
  0.7-1.4s warm, dominated by Neon round trips, not row counts. The nav badge
  read 7627 and now caps at 999+ with the exact figure in its tooltip. Retention
  covers leads only — prospects grow unbounded, which is fine for years and is
  written down rather than assumed.
- 2026-09-10 — The sidebar icons are the design's own now (Icons/inbox 3:306,
  search 3:310, calendar 3:308, list 3:307, settings 3:309), replacing Lucide
  paths that were a different drawing at a heavier stroke. Weekly review has no
  counterpart in the set and says so. The other 34 symbols stay unimported.
- 2026-09-10 — Two more unordered queues found at the new scale: enrichment took
  an arbitrary 25 of 9,156 and monthly refresh an arbitrary 200 of 23,203.
  Enrichment now goes best-first, refresh oldest-first, so each budget rotates
  instead of redrawing the same sample. Token payloads re-measured after the
  country load: still 1,672 estimated, because the enhance prompt is capped at 10.
- 2026-09-10 — `search:run --drain` died with "Maximum call stack size
  exceeded": one INSERT of tens of thousands of rows, which Drizzle cannot even
  build (it merges SQL fragments recursively) and Postgres would refuse anyway at
  65,535 bind parameters. `persist` now writes in batches of 500 (`lib/chunk.ts`).
  A city search with 12 categories had failed the same way with a different
  message. The drain also names each search before starting it and no longer
  strands the queue when one fails.
- 2026-09-10 — The prospect Email button logged a send and then deleted its own
  row: logging sets the prospect to `contacted` and the top-25 queue lists only
  `new`, so `router.refresh()` unmounted the fallback address. Nothing opened,
  nothing showed, prospect spent. Email now holds the row open with a real
  mailto anchor until dismissed; guarded by `tests/prospect-contact-source.test.ts`.
- 2026-09-10 — A country-wide search queues and nothing drains it. `/prospects`
  now says so with `pnpm search:run --drain` to copy, instead of a note that
  read as "nothing happened".
- 2026-09-10 — `pnpm tokens:estimate` sizes the four real model payloads without
  a model, so the 25k target is checkable today rather than after someone
  records a run by hand. Tonight: 1,683 estimated input tokens, nearly all of it
  the enhance prompt. `pnpm tokens` still reads "(not measured)" and still needs
  `tokens:record` after a real /daily-run.
- 2026-09-10 — `/review` gained the score distribution (Figma 3:1694). It is the
  only thing on that page that can see leads nothing was ever sent to, so a
  scorer collapsed into one band stops looking like silence. Production draws
  0 / 6 / 51 / 66 / 49 across the five bands.
- 2026-09-10 — `/settings` now says whether Gmail will accept a draft right now,
  by refreshing the token. The only previous signal was `pnpm gmail:drafts`
  failing at the end of a run.
- 2026-09-10 — Figma second pass: the lead header now carries the design's
  ScoreMeter (3:1048 / 3:1973), which the page had never shown above the fold.
  The four 360px frames are audited and the mobile bottom nav is recorded as
  deliberate divergence — the nav is six items now, not the design's four.
- 2026-09-10 — `lib/health.ts` computed the run schedule from `0 20` after the
  cron moved to `17 20`. Grace absorbed it, so it never showed. A test now
  parses the workflow and fails if the two copies drift again.

## Reminders that bite

- WhatsApp capability needs `libphonenumber-js/max` — the default metadata
  returns `undefined` type for every PH number and calls landlines mobile
- Never suppress a platform domain (`weebly.com`, `wixsite.com`, …): one "no"
  would block every business using that site builder
- `enrichment_status` is the enrichment queue; a row found without a website is
  `no_website` and must be reopened when one appears, or its site is never read
- Overpass 504s several times a day. It is load, not a bug — retry
- Vercel Hobby cron is **once per day, ±59 min** — the scheduler is GitHub Actions
- Vercel Hobby is **non-commercial only**
- Neon autosuspends at 5 min idle and cannot be told not to; use the HTTP driver
- Phases 1–3 contain **zero** model calls. Keep it that way.
- `contentHash` stability is the single biggest cost lever — its test is not optional
- The preview pane sometimes stops applying streamed updates and every page sits
  on `loading.tsx` for ever. Check with curl before believing it — see RUNBOOK
- `tokens:record` writes to the **most recent** run and its figures come from a
  person — never paste numbers out of a usage line
- Tailwind's spacing scale is **replaced**, keys 0-12 only. `py-0.5`, `h-14`,
  `py-16` emit nothing and fail silently — use an arbitrary value like `h-[6px]`
