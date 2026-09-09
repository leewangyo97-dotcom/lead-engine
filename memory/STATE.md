# STATE — read this first, every session

**Cap: 150 lines.** When it exceeds that, roll closed items into `DECISIONS.md`
and truncate. This file is read every session; every line costs tokens repeatedly.

Last updated: 2026-09-10 · Phase: **all six complete, plus geo prospect discovery.**

## Right now

**The machine ran unattended for a week and nothing broke.** Nightly runs on 3,
4, 7 and 8 September all green; weekends correctly skipped. 341 leads, 44
harvested in the last six days, 446 prospects, 357 tests passing.

**Fifteen sends, no replies yet.** Two leads by email (This Dot Labs, Atria) and
thirteen prospects by WhatsApp and email, all on Wednesday 9 September, one row
per prospect — the reopen window is holding, no click storm this time. The
ladder is armed for the first time: day 4 comes due 13 September. `/review`
wants 20 sends before it will call a difference real, so it is close.

Two live chores: the Gmail refresh token expires seven days after each
`pnpm gmail:auth` while the consent screen is in Testing (it expired 8
September — publishing the app ends the chore), and searches are manual, so
prospect supply only grows when someone runs `pnpm search:run`.

Corrected 2026-09-09: the "missed" nightly run of 2 September was not missed. It
started at 20:24 UTC, four minutes after a check made at 04:20 Manila — the local
date had rolled over and UTC had not. The cron was moved to 20:17 on a false
premise; harmless, but the schedule was never broken. The weekend false alarm the
same session fixed was real.

**Geo prospect discovery is live in production.** `/prospects` searches
OpenStreetMap by place and category, enriches websites, scores, and opens a
pre-filled WhatsApp or email message. First real search (Cebu City — veterinary,
clinics, dentists) found 151 businesses: 23 reachable, 4 with a website, 3
enriched, 1 refused by its own robots.txt.

Two markets, measured, and they behave nothing alike:

| Search | rows | websites | phones | emails |
|---|---|---|---|---|
| Cebu City — vets, clinics, dentists | 151 | 4 | 21 | 8 |
| Austin — contractors, trades, pro services | 108 | 71 | 70 | 18 |
| Sydney — contractors, trades, specialists | 187 | 75 | 64 | 21 |

In the Philippines almost nobody has a website, so WhatsApp is the only channel
that reaches anyone and site-health scoring is inert. Abroad the opposite holds:
US contractors had 33 websites in 37 rows, enrichment pulled real addresses off
them, and the pitch has something to point at. `chooseChannel` picks per
prospect for exactly this reason.

Commands: `pnpm search:run "<place>" <categories>` · `pnpm enrich` ·
`pnpm prospects:score` · `pnpm prospects:refresh` · `pnpm prospects:enhance` →
Claude Code → `pnpm apply:enhance`. The nightly job now enriches (bounded at 25)
and re-scores; the monthly job refreshes map data.



**The system produced its first outreach draft on 2026-09-02, unassisted.** The
scheduled nightly run harvested This Dot Labs — an AI-native consultancy hiring a
Senior Android Engineer (Kotlin) and a Senior React Native Engineer, remote-first
and global. Pre-score 75, stage 2 took it to 80 for an unusually precise stack
match: those two roles are his two strongest bands, both named.

It was sent on 9 September, addressed to jobs@thisdot.co, and logged. Draft id
r1950667528497554225.

That closes the last open exit test. Every phase now has evidence behind it, and
the funnel has run end to end without anyone deciding to help it.

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

- 2026-09-10 — `pnpm tokens:estimate` sizes the four real model payloads without
  a model, so the 25k target is checkable today rather than after someone
  records a run by hand. Tonight: 1,683 estimated input tokens, nearly all of it
  the enhance prompt. `pnpm tokens` still reads "(not measured)" and still needs
  `tokens:record` after a real /daily-run.
- 2026-09-10 — Figma screen audit finished, all seventeen frames. The mock's
  numbers contradict each other between sizes (score bands, weights, thresholds,
  source names), so structure comes from it and no figure does.
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
- 2026-09-10 — Three more dead spacing classes found by measuring elements in
  the browser: `py-0.5` on every count badge and kbd key, `h-1.5` on the lead
  page's overlap dot (0x0 since it was written), `py-16` on the empty inbox.
  `tests/spacing-scale.test.ts` reads the scale out of the config and now
  refuses any class the scale has no key for.
- 2026-09-10 — `/followups` draws the ladder as a track (Sent, Day 4, Day 11)
  from `ladderRungs()`, per Figma 3:1437, instead of printing "step 2".
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
- Tailwind's spacing scale is **replaced**, keys 0-12 only. `py-0.5`, `h-14`,
  `py-16` emit nothing and fail silently — use an arbitrary value like `h-[6px]`
