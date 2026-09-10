# STATE — read this first, every session

**Cap: 150 lines.** When it exceeds that, roll closed items into `DECISIONS.md`
and truncate. This file is read every session; every line costs tokens repeatedly.

Last updated: 2026-09-10 · Phase: **all six complete, plus geo prospect discovery.**

## Right now

**The machine ran unattended for a week and nothing broke.** Nightly runs on 3,
4, 7 and 8 September all green; weekends correctly skipped. 341 leads, 44
harvested in the last six days, 512 tests passing. Prospect counts are below —
they moved by two orders of magnitude on 10 September.

**Fifteen sends, no replies yet.** Two leads by email (This Dot Labs, Atria) and
thirteen prospects by WhatsApp and email, all on Wednesday 9 September, one row
per prospect — the reopen window is holding, no click storm this time. The
ladder is verified, not assumed: asking `getDueFollowups` with a future date
gives 18 due by 15 September — 16 prospects, 2 leads, all step 1 — with the first
becoming due **Sunday 13 September at 19:31 Manila**, so Monday morning is when
to work them. `/review`
wants 20 sends before it will call a difference real, so it is close.

Two live chores: the Gmail token expires seven days after each `pnpm gmail:auth`
while the consent screen is in Testing (publishing ends it), and searches are
manual.

**23,203 prospects after the first country-wide searches** (Australia schools
13,134; Australia clinics/vet/dentists 6,786; a 12-category Cebu City search
2,837 — checked against the search ids on 10 September, having first written
these two the wrong way round). 7,643 reachable, 21 MB of a 512 MB database. All scored: 72 hot, 1,201
warm, 21,930 cold. **9,156 are queued for enrichment and the nightly takes 25** —
a year of nights, so the queue is now ordered by score. Deleting the schools
search is a reasonable call; see RUNBOOK "After a country-wide search".

**Geo prospect discovery is live in production.** `/prospects` searches
OpenStreetMap by place and category, enriches websites, scores, and opens a
pre-filled WhatsApp or email message.

Two markets that behave nothing alike: in the Philippines almost nobody has a
website (4 in 151 Cebu rows), so WhatsApp is the only channel that reaches anyone.
Abroad the opposite — 71 of 108 Austin rows had one. `chooseChannel` picks per
prospect for that reason. Figures in DECISIONS.

Commands: `search:run` · `enrich` · `prospects:score` · `prospects:refresh` ·
`prospects:enhance` → Claude Code → `apply:enhance` → `drafts:verify`. Nightly
enriches (25) and re-scores; monthly refreshes map data.



Working copy `C:\dev\lead-engine`; `F:\lead-engine` is corrupt, awaiting chkdsk.

## Seventeen enhanced drafts are waiting, all verified

Written 10 September, the first time the enhance loop had ever run — every one of
the sixteen prospect messages sent before it was `firstMessage()` with the name
swapped. Per-business, built only from recorded facts, stored unsent. Open
`✦ Enhance` on a row to compare before sending.

**Two of nineteen were deleted for being false, and both were caught by opening
the site.** CDW Studios was told their site has no viewport tag and no contact
details; it has both — the signals had been measured on a 52-byte `403` body, and
`looksLikePage` now requires markup before anything is measured. Leura Wellness
was told they have no website; their email is at leurawellness.com.au, which
serves a live site, and `ownDomainFromEmail` now withholds the `no_website`
signal when the domain resembles the business name, which makes the claim
unshippable rather than merely discouraged.

The remaining seventeen: zero verifier violations, OSM re-read and confirming no
website for any, sixteen on free providers. Foodfiesta.ph was skipped for the
same reason before it was written.

**The rule is now a command:** `pnpm drafts:verify` opens the sites a draft talks
about and exits non-zero on a false claim.

Seventeen came back unverifiable — all on free email providers, no domain to
probe — so the messages were changed instead. "You don't have a website" became
"I couldn't find a website for you", in the template and in every draft: a fact
about the search rather than a claim about them, which is the half this project
can stand behind. They now report `no checkable claim`, which the tool counts
separately from `checked and true`.

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

**Waiting on a decision: the deployment is public with no access control.**
Checked 10 September — `/prospects` serves 25 businesses' phone numbers and email
addresses to anyone, and every write endpoint (`contact`, `decline`, `outcome`,
`searches`) is open. `robots.ts` and a noindex are in; they stop indexing, not
access. Cheapest fix is Vercel Deployment Protection, which is a dashboard
setting and no code. See RUNBOOK "The deployment is public".

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

## Open questions for Joshua

- Public or private GitHub repo? Public = unlimited Actions minutes; private =
  2,000/month, which is still plenty. Public also means the code is visible —
  fine, since no secrets are in it, and it doubles as a portfolio piece.
- Resume says "seeking full-time remote"; the tool is built for contract. Which is it?

## Recently done



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
