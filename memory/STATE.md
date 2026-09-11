# STATE — read this first, every session

**Cap: 150 lines.** When it exceeds that, roll closed items into `DECISIONS.md`
and truncate. This file is read every session; every line costs tokens repeatedly.

Last updated: 2026-09-11 · Phase: **all six complete, plus geo prospect discovery.**

## Right now

**The machine ran unattended for a week and nothing broke.** Nightly runs on 3,
4, 7 and 8 September all green; weekends correctly skipped. 341 leads, 44
harvested in the last six days, 599 tests passing. Prospect counts are below —
they moved by two orders of magnitude on 10 September.

**Eighteen sends, no replies yet.** Two leads by email (This Dot Labs, Atria) and
sixteen prospects on Wednesday 9 September, one row each — the reopen window is
holding. `/review` wants 20 before calling a difference real, so it is close.

**The ladder is verified and now has messages of its own.** Asking
`getDueFollowups` with a future date gives 18 due by 15 September — 16 prospects,
2 leads, all step 1 — the first becoming due **Sunday 13 September at 19:31
Manila**, so Monday morning is when to work them. Until 11 September a prospect
follow-up would have re-sent the opening message word for word; `followUpMessage`
writes steps 1 and 2 now.

Two live chores: the Gmail token dies seven days after each `pnpm gmail:auth`
while the consent screen is in Testing (publishing ends it); searches are manual.

**23,203 prospects after the first country-wide searches** (Australia schools
13,134; Australia clinics/vet/dentists 6,786; a 12-category Cebu City search
2,837). 7,643 reachable, 21 MB of 512 MB. Scored: 72 hot, 1,201 warm, 21,930
cold. **~9,100 queued for enrichment against a nightly 200** — 46 nights, down
from 364: hosts are fetched five at a time and the cap was raised. Queue ordered
by score. Deleting the schools search is a reasonable call; see RUNBOOK.

**Geo prospect discovery is live in production.** `/prospects` searches
OpenStreetMap by place and category, enriches websites, scores, and opens a
pre-filled WhatsApp or email message.

Two markets that behave nothing alike: almost nobody in the Philippines has a
website (4 in 151 Cebu rows) while 71 of 108 Austin rows did, so `chooseChannel`
picks per prospect. Figures in DECISIONS. None of the 17 unsent drafts has a
website — they are Cebu food and retail, reached by WhatsApp.

The loop is `/prospect-run` (new 11 September — the prospect side had no command
while the lead side had one, which was backwards given which funnel produces
anything). Nightly enriches 200 and re-scores; monthly refreshes map data.

**`pnpm lh <prospectId>` measures one site properly** — headless Chrome, 10-47s,
on demand and never nightly (200 sites would be 42 min against a 15-min budget).
Only audits proven identical across two runs are stored; the score is not, and
`message-verify` rejects any draft quoting one. Three signals: `page_weight` at
3 MB, `contrast` at 10, `unsized_images` at 5. **All 11 drafted prospects with
websites measured 11 Sept** — 0 crossed weight, 3 crossed contrast (Dresden 49,
Alta Roofing 40, Fixorvo 16), 2 crossed unsized (Fixorvo 26, Chu 10).

Working copy `C:\dev\lead-engine`; `F:\lead-engine` is corrupt, awaiting chkdsk.

## Seventeen enhanced drafts are waiting, all verified

Written 10 September, the first time the enhance loop had ever run — every one of
the sixteen prospect messages sent before it was `firstMessage()` with the name
swapped. Per-business, built only from recorded facts, stored unsent. Open
`✦ Enhance` on a row to compare before sending.

**Two of nineteen were deleted for being false, and both were caught by opening
the site** — CDW Studios (signals measured on a 52-byte `403`; `looksLikePage`
now requires markup) and Leura Wellness (told they had no website; theirs is at
leurawellness.com.au, so `ownDomainFromEmail` now withholds `no_website`, making
the claim unshippable rather than discouraged). Both write-ups in RUNBOOK.

The remaining seventeen: zero verifier violations, OSM re-read confirming no
website for any, sixteen on free providers.

**The rule is now a command:** `pnpm drafts:verify` opens the sites a draft talks
about and exits non-zero on a false claim.

All seventeen came back unverifiable — free email providers, no domain to probe —
so the messages changed instead: "you don't have a website" became "I couldn't
find a website for you", a fact about the search rather than a claim about them.
They now report `no checkable claim`, counted separately from `checked and true`.

## Next three actions

1. **Publish the Google OAuth consent screen.** While it is in Testing the
   refresh token dies every seven days and `pnpm gmail:drafts` stops with it.
2. **Work the follow-ups on Monday 14 September.** 18 come due — 16 prospects, 2
   leads (Atria, This Dot Labs). Prospect follow-ups are written by the app on
   the click. `pnpm followups` emits the two leads only and says so; both pass
   `checkStep` at step 1, and each item must carry its `"step"`.
3. The contract weight is still open, but less urgently: a full-time posting just
   cleared 75 on stack merit alone. `/rejected` still quantifies the cost —
   1 qualifies today, 6 would if full-time counted as acceptable terms.

## Blocked

**Waiting on a decision: the deployment is public with no access control.**
Checked 10 September — `/prospects` serves 25 businesses' phone numbers and email
addresses to anyone, and every write endpoint (`contact`, `decline`, `outcome`,
`searches`) is open. `robots.ts` and a noindex are in; they stop indexing, not
access. Cheapest fix is Vercel Deployment Protection, which is a dashboard
setting and no code. See RUNBOOK "The deployment is public".

## The lead funnel is supply-starved

`pnpm leads:diagnose`: the average job lead scores 33 of 100 against a threshold
of 75, and no single dimension fixes it — timezone projects to 56, stack to 49.
Two boards surveyed on 10 September, neither built. Full figures and reasoning in
DECISIONS.

## Open questions for Joshua

- Public or private GitHub repo? Public gives unlimited Actions minutes and
  doubles as a portfolio piece; no secrets are in the code either way.
- Resume says "seeking full-time remote"; the tool is built for contract. Which?

## Recently done

11 September, all in DECISIONS: prospect follow-up messages, `drafts:verify`,
the two false-claim fixes behind it, and `pnpm lh` with its two signals.

## Reminders that bite

- `refreshProspects({ ids, enrich: true })` now passes those ids to
  `runEnrichment`; without it, it enriched the global top of the pending queue
  and left the requested rows at `pending`
- OSM values are normalised at the write path, never stored raw: emails via
  `firstUsableEmail`, social accounts via `normaliseSocial` (a handle is not a
  link, and `/p/` means a page on Facebook but a post on Instagram)
- HTML is parsed with `cheerio`, not regexes — two regexes had produced real
  false claims. `.text()` fuses adjacent elements, so `stripTags` joins text
  nodes with a space
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
