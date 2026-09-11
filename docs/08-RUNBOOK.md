# Runbook — what to do when something breaks

Every fault this system raises, what it actually means, and whether it needs you.

Most of these are transient. The system is built so a bad night costs nothing:
the content hash means a missed harvest is re-collected the next run, and no lead
is lost by a source being down.

---

## `N source(s) failed on the last run`

**Seen:** red nightly run, fault banner on the inbox, `/api/health` `ok: false`.

**Usually:** the upstream API returned 500s or timed out. Algolia (which serves
both HN adapters) does this in bursts. Each request already retries three times
with backoff before the source is marked failed.

**Do:** nothing, the first time. Check whether the next run recovers:

```bash
pnpm nightly
pnpm report
```

If the same source fails for **three consecutive nights**, the adapter is broken
rather than the API being unwell — a site redesign or a moved endpoint. Fix it in
`lib/sources/<id>.ts`; the fixture in `lib/sources/__fixtures__/` shows the shape
the parser expects.

**Cost of ignoring it:** none for a night or two. The hash re-collects everything
missed. A source down for a week is a week of that source's leads never seen.

---

## `every source returned zero items — the pipeline has starved`

**Means:** no adapter returned anything. That is never legitimate — it is a
network problem at your end, an expired secret, or all upstreams down at once.

**Do:** check `DATABASE_URL` is set and the machine has network. Run
`pnpm harvest` by hand and read the per-source lines.

---

## `N source(s) have not run in 36h`

**Means:** the scheduler stopped. The cron is `0 20 * * 1-5`, so a Monday run is
more than 24 hours after Friday's — 36 is the threshold precisely so a normal
weekend does not trip it.

**Do:** check the workflow is enabled. GitHub disables scheduled workflows after
60 days of repository inactivity; `scripts/keepalive.ts` exists to prevent that,
but a repository nobody pushes to for two months will still stop.

---

## `warning: N source(s) returned nothing while others worked`

**Not a fault.** RemoteOK yields three or four engineering roles from a hundred
items, so zero is a slow day. The run stays green deliberately — failing on it
would produce red runs nobody caused, and those train you to stop reading them.

**Do:** nothing, unless the same source is named on several consecutive days.
Then treat it as a dead adapter, as above.

---

## Gmail: `invalid_grant`

The error now says this itself, but the deadline is worth knowing in advance:
while the OAuth consent screen is in **Testing**, Google expires refresh tokens
seven days after they are issued. The Gmail step will fail about a week after
each `pnpm gmail:auth`, whatever else is working.

Publishing the app in the Google Cloud console stops the expiry. Until then this
is a weekly chore, and the nightly job will keep drafting regardless — only the
Gmail step fails, so nothing is lost but the draft's delivery to the mailbox.


**Means:** the refresh token expired. The OAuth app is in Google's Testing mode
on purpose — publishing would trigger a verification review a single-user tool
does not need — and Testing-mode refresh tokens **expire after 7 days**.

**Do:**

```bash
pnpm gmail:auth
```

Approve in the browser, paste the printed line into `.env.local`. Then confirm:

```bash
pnpm gmail:smoke
```

That creates a draft, reads it back, and deletes it. A green run leaves the
mailbox exactly as it found it.

---

## The inbox is empty

Two different situations, and the page says which:

- **"The nightly run fills this at 04:00 Manila"** — nothing harvested yet. Wait.
- **"N leads were harvested and set aside by the filter"** — everything was
  judged and rejected. Look at `/rejected`: the reason tally says what the filter
  objected to, and the score distribution says whether anything came close.

The second is not a malfunction. It has been the normal state of this system: the
sources carry mostly onsite, full-time work.

---

## A role slipped through that is not engineering work

A "Senior Product Manager" once reached the inbox at 67 — remote, contract,
$96-118/hour. Every weighted dimension was excellent, so it passed on merit.

```bash
pnpm audit:titles
```

Lists anything scoring 50+ whose title reads like a non-engineering role. It is a
report, not a filter: it cannot tell whether an unusual title is wrong, only that
it deserves a glance. Worth running after adding a source, which is when a new
vocabulary of job titles arrives.

## You changed a rule and want it applied to existing leads

A disqualifier or rubric edit only affects future harvests — the content hash
means today's leads are never re-fetched, so they keep whatever the old rule
decided and the funnel counts describe a filter that no longer exists.

```bash
pnpm refilter
pnpm prefilter
```

`refilter` returns judged leads to `harvested` and clears their scores and
disqualify reasons; `prefilter` then judges them under the current rules.

It will not touch anything drafted, in Gmail, answered, won or lost — those carry
outcome history, and re-judging them could mark a lead disqualified after an
email had already gone out. It refuses outright if any outreach row exists.
`--force` exists and you should need a reason to type it.

## A run cost more than expected

```bash
pnpm tokens
```

Exits non-zero over 40,000 for a single run. That is nearly always a filter that
stopped filtering rather than a prompt that grew — check the `survived` column
against its usual value before looking anywhere else.

---

## A follow-up went out as a first email

It cannot now. `apply:drafts` takes a `step` and checks it against what has been
sent: 0 only when nothing has, otherwise exactly the next rung, never a duplicate
of an unsent rung, never past the end of the ladder. A nudge without a step is
refused with the reason, rather than stored as a second opening message.

If you see two step-0 rows for one company in `outreach`, they predate this check
(9 September 2026). The follow-up queries read the highest step, so the ladder
will have stalled on that lead — set the later row's step by hand to unstick it.

## Retention deleted something you wanted

It cannot delete a lead that was ever written to. Anything with an outreach row
is kept regardless of status or age, because `outreach` and `events` cascade from
`leads` and those outcomes are the whole input to the weekly review.

What it does remove: leads at `disqualified`, `parked` or `closed`, older than 45
days, that never produced a message. Those are reconstructible — the same posting
would be harvested again if it reappeared.

The monthly run prints both numbers, so "deleted 40 ... kept 3 that carry
outreach history" is the expected shape.

## Hydration errors mentioning `bis_skin_checked`

Not this app. A Bitdefender-family browser extension rewrites the DOM before
React loads, adding `bis_skin_checked` to divs and `bis_register` to `<body>`.
React compares its own output against a document someone else has edited and
reports a mismatch. Neither attribute appears anywhere in this repo — grep for
them and you get nothing.

It is usually cosmetic, but React's message is honest that it "won't be patched
up": when hydration is abandoned the page can be left on its loading skeleton,
which on this dark theme reads as a black screen.

To confirm it is the extension, open the same page in a private window with
extensions disabled. To fix it, turn that extension off for localhost. Do not
paper over it with `suppressHydrationWarning` on `<body>` — the injected
attributes are on nested divs too, so it would silence the warning without
fixing the render, and hide a real mismatch later.

## The nightly run did not happen

GitHub queues scheduled workflows and drops them under load — it skipped 2
September entirely. Nothing is wrong with the repo when this happens, and the
next night usually runs.

Check with `gh run list --workflow=nightly.yml`. To catch up by hand:

    pnpm harvest && pnpm prefilter && pnpm enrich --limit=25 && pnpm prospects:score

Health notices this by itself: a source whose last run predates the most recent
scheduled slot is reported as having missed it, six hours after the slot passed.
That check knows the schedule is Mon-Fri, so a quiet weekend is not a fault.

## Prospect discovery: `The free map service is busy`

Overpass returned 504. It is a free, shared endpoint and this happens several
times a day; the client already retries three times before giving up.

Wait a minute and run it again. If it persists for hours, narrow the search — a
radius search over one city is cheap, a whole-country area search is not, and
the area queries are the ones that get shed first under load.

The nightly and monthly jobs mark these steps `continue-on-error`, so a busy
endpoint never fails the run or blocks the job pipeline.

## `enrich: nothing pending with a website`

Not a fault. Stage A stores a website only when OpenStreetMap has the tag, and
in this market that is rare — 4 of 151 on the first real Cebu search. Stage B has
nothing to visit because there is nothing to visit.

If you expect a website to be there, check `enrichment_status`: a row that was
found without one is marked `no_website`, and gaining a website later reopens it
to `pending` automatically on refresh or hand edit.

## Working the prospect list day to day

`/prospects` with no search selected is the work queue: the best 25 reachable
prospects across every search, contacted and declined rows removed. Pick a search
from the chips only when you want to see everything that search found.

Send with WhatsApp or Email on the row. When something comes back, record it on
the same row — replied, won or lost. That is not bookkeeping: an unanswered
prospect is chased again on day 4 and day 11, and recording the answer is what
stops it. Every outcome has an undo.

## A prospect asked not to be contacted

Use "they said no" on the row. That records every identifier they own — phone,
WhatsApp number, email, and their own domain — and marks the row
`do_not_contact`, which both contact buttons then refuse.

Platform domains (`weebly.com`, `wixsite.com`, `business.site`, …) are
deliberately never suppressed: they identify the site builder, not the business,
and one "no" would otherwise block every business using the same builder.

To undo, delete the rows from `suppressions` and set the prospect's `status`
back to `new`. There is no button for this on purpose.

## Prospects exist but none are reachable

Read the `prospects:` line in the nightly report — it counts reachable rows, not
just rows, because the way this pipeline starves is plenty of businesses with no
phone and no email.

If `reachable` is near zero, the categories are the likely cause: schools and
government offices are well mapped but rarely list a contact. Search a category
that sells to the public.

## The prospect list looks wrong after a weight change

`pnpm prospects:score` re-scores everything from stored data. No network, no
model, safe to run repeatedly. The nightly job does it anyway, so a weight change
takes effect by the next morning without anyone remembering.

Hover any score to see what it is made of. If the reasons look right and the
order still looks wrong, the weights in `lib/places/score.ts` are what to argue
with — not the query.

## Before deploying anything

```bash
pnpm gate
```

typecheck, tests, and a production build. It builds into `.next-gate`, so it is
safe to run while `pnpm dev` is up.

The database-backed checks need a scratch branch and are not part of the gate,
because CI has no `DATABASE_URL` and the unit tests are deliberately pure:

```bash
neon branches create --name check --project-id <id>
URL=$(neon connection-string check --project-id <id> --pooled --database-name neondb)

INTEGRATION_DATABASE_URL=$URL pnpm test:integration   # draft/verify/Gmail-gate path
MIGRATION_CHECK_DATABASE_URL=$URL pnpm db:migrate:check  # migrations on an EMPTY db

neon branches delete check --project-id <id>
```

Both refuse to run against the database in `DATABASE_URL`: one truncates tables,
the other drops the schema. A Neon branch is a copy of production, so
`db:migrate:check` empties it first — testing against an unmodified branch would
prove nothing, since every table is already there.

## The preview pane stops applying streamed updates

**Symptom.** Every page shows `loading.tsx` ("Loading today's leads") for ever,
in every tab, including a newly opened one. `document.querySelectorAll('main')`
returns two: the fallback, and the real content sitting inside a `<div hidden>`
that was never swapped in.

**What it is not.** Not the app. Check the server directly:

```
curl -s http://localhost:3000/settings | grep -c Thresholds
```

A `1` means the server streamed the whole document — the content, the resolved
Suspense boundaries and the reveal scripts are all in the response. It was
observed at 0.43s for a page that the pane had been showing as "loading" for
minutes. Restarting the dev server and deleting `.next` did not change it, so it
is not the stale-chunk fault below either.

**What to do.** Verify server-side and carry on; do not redesign a page around
it. Every page here is a two-flush page — the shell streams its nav counts and
the engine-health line behind Suspense — so this affects all of them equally,
and a page that renders in one flush would still stream the shell.

## A country-wide search sits at "queued" and nothing happens

**Symptom.** `Search` on a place with no comma — "Australia" — returns a note and
no rows. The chip under Recent searches reads `queued` for ever.

**Why.** A country geocodes to an OpenStreetMap *area* rather than a point and
radius. Querying an area that size takes minutes, longer than a serverless
function may run, so `POST /api/searches` writes the row and stops. Nothing
drains the queue on its own — there is no worker process, by design.

**What to do.**

```bash
pnpm search:run --drain
```

It processes every queued search in order and prints found/new/dupes for each.
The `/prospects` form now says this on screen with the command to copy, so the
queued state is not a dead end. Expect minutes per country and the odd Overpass
504 — that is load, not a fault; run it again.

**If you did not mean to queue one**, search a city instead: anything with a
comma ("Sydney, Australia") geocodes to a radius and runs inside the request in
two or three seconds.

## "Maximum call stack size exceeded" from a search

**Symptom.** `pnpm search:run --drain` dies with `RangeError: Maximum call stack
size exceeded` and no other detail. The search row is left `failed`, and — before
this was fixed — every search behind it in the queue stayed `queued` with nothing
said about it.

**Cause.** One INSERT with too many rows. A whole-country Overpass query returns
tens of thousands of places, and the prospects insert names 32 columns; Drizzle
builds SQL by merging fragments recursively, so a large enough `values()`
overflows the call stack before a query is ever sent. Postgres has a second
ceiling behind it: 65,535 bind parameters per statement, which this table reaches
at about two thousand rows. The same failure appeared as a truncated
`Failed query: insert into "prospects" ...` on a city search with twelve
categories, which is the same bug wearing a different message.

**Fixed.** `persist` writes in batches of 500 (`lib/chunk.ts`). The drain also
reports each search before it starts, and one failure no longer strands the rest
of the queue.

**To retry a failed search**, set it back to `queued` and drain again — the
content of the row is still good, only the write failed.

## After a country-wide search

One country changes the scale of everything downstream. Australia (clinics,
veterinary, dentists) plus Australia (schools) plus a twelve-category Cebu City
search took the table from 446 rows to 23,203 — 21 MB of a 512 MB database, so
storage is not the constraint. These are:

**Score them, or they are invisible.** `/prospects` sorts `score desc nulls
last`, so 22,757 unscored rows sit below the few hundred that were already
scored and never appear in the top 25.

```bash
pnpm prospects:score
```

Deterministic, no network, no model, and idempotent — 23,203 rows in about 11
seconds now that it writes in batches rather than one statement per row.

**Enrichment is the real bottleneck.** 9,156 of those rows have a website and
are queued for enrichment, and the nightly job takes 25. That is a year of
nights. It now takes the highest-scoring pending rows first, so the useful ones
land in the first weeks, but the backlog is still a backlog. Three honest
options:

- Leave it. The queue is ordered, so the top of it is worked first.
- Raise the nightly limit in `.github/workflows/nightly.yml`. Each row is one
  HTTP fetch of someone's site, so this is politeness-bound, not cost-bound.
- Delete a search that was not wanted: `delete from searches where id = '...'`
  cascades to its prospects.

**A search you did not mean to run** is worth deleting rather than leaving in the
queue — a whole country of schools is 13,134 rows, the largest single thing in
this table, and it will otherwise compete for enrichment budget for months.

## Retention covers leads, not prospects

`pnpm retention` prunes leads in a dead status (`disqualified`, `parked`,
`closed`) after 45 days. It does not touch `prospects` at all, so that table only
grows — 23,203 rows and 12 MB as of 10 September, against a 512 MB database.

That is deliberate for now rather than an oversight, and it is written down here
so the monthly job's "storage stays flat" comment is not read as covering both.
At this rate the ceiling is roughly a million rows, which is years away, and any
prospect deletion policy is a judgment about someone's own lead list — a
`do_not_contact` row in particular is the record of a refusal and deleting it
would lose the reason the suppression exists.

If it ever needs cutting, the honest order is: a search nobody worked, whole
(`delete from searches where id = '...'` cascades), before any per-row rule.

## Two businesses, one phone number

Across 23,203 prospects, 95 rows carry a phone number that another row already
has. They are not duplicates: twelve preschools in Victoria answer on one council
switchboard, three RMIT campuses share the university's line, "Vets of Geelong"
appears three times on one number. OpenStreetMap has them right.

The work queue used to serve those as separate work, which means messaging one
number twelve times. `getTopProspects` now over-fetches and keeps the
best-scoring row per number (`lib/places/dedupe-queue.ts`); a search's own page
still shows everything it found, because "what did we find" and "who do I
message next" are different questions.

The reopen window in `outreach-log` cannot cover this — it guards a prospect
against a second message, and these are genuinely different businesses.

**If you message one and want the rest gone**, marking the prospect declined adds
its number to the suppression list, which covers every row carrying it.

## Emails come from OpenStreetMap unvalidated

Two rows in 23,203 held an address the app could not use:
`info@heathmontfamilydentistry` (no top-level domain) and
`hello@…;admin@…` (OSM stores multiple values semicolon-separated). The first
would build a mailto: that goes nowhere; the second addresses nobody, and stored
whole it made a reachable business look unreachable.

Enrichment had always applied `isUsableEmail` to addresses it scraped. Discovery
trusted its source and did not. It now runs `firstUsableEmail`, which takes the
first usable value out of a multi-value tag and returns null for a broken one.
Both existing rows were corrected — one cleared, one recovered.

## Narrowing the work queue

`/prospects` with no search selected is the work queue, and it carries chips for
category and city with a count on each:

```
/prospects?category=clinics
/prospects?city=Cebu+City&category=clinics
```

The counts are the point. 5,162 schools sit above 1,206 clinics in this table,
which is invisible until the chips say so. Clicking an active chip clears just
that one; `Clear` drops both. An unknown category in a URL is ignored rather than
matched, so a mistyped link shows the whole queue instead of an empty page.

Only the queue filters. A search's own page (`?search=...`) answers "what did
this search find", and narrowing that would quietly answer something else.

**City is sparse, and that is an OpenStreetMap fact.** Australia names a suburb,
not a city: `addr:city` was set on 217 of 20,107 Australian rows. The extractor
now falls back through `addr:suburb`, `addr:town`, `addr:village`,
`addr:municipality` and `addr:hamlet`, so newly discovered rows carry a locality
— but rows already in the table keep whatever they were stored with until
`pnpm prospects:refresh` reaches them, which is 200 a month.

To fill them in sooner, raise that limit for one run:

```bash
pnpm prospects:refresh --limit=2000
```

Each row is an Overpass lookup, so this is politeness-bound. Do it in a few
passes rather than all at once.

## Reading past the first 200 of a search

A search's own page shows 200 rows at a time with prev/next below the table, and
the header says which slice you are on (`201–400 of 13134`). Before this it
showed the first 200 and offered no way to the rest: 12,934 rows were in the
table, counted in the header, and unreachable.

```
/prospects?search=<id>&page=2
```

A page past the end lands on the last one rather than showing nothing, so a
bookmark kept after rows were pruned still works.

**Why prev/next and not numbered pages.** 13,134 rows is 66 pages, and a strip of
66 numbers is not navigation. The rows are ordered best-first, so anyone reading
past page three is browsing rather than searching.

**Paging is exact because the sort ends in the row id.** Score, reachability and
name all tie in bulk — "Greencross Vets" is 20 branches at 20 addresses, "Denture
Clinic" is 7 — and Postgres may order tied rows differently between queries,
which makes an offset skip some and repeat others. With the id as the last key,
zero row ids appear on two pages; the duplicate *names* across pages are real
businesses.

## The deployment was public and has no access control — closed

**Closed 11 September** with Vercel Authentication: Project → Settings →
Deployment Protection → Vercel Authentication → Require Log In, scope **All
Deployments**. Verified from outside the account — `/`, `/prospects`,
`/api/health` and `POST /api/prospects/<id>/contact` all answer 302 to
`vercel.com/sso-api`, so the mutating endpoints are behind it and not only the
pages. Zero code and no users table.

Nothing automated broke, which was checked first: the nightly workflow runs
scripts against Neon directly and never calls the deployment, so the only
consumer of that URL is a browser. Sign in to the Vercel account that owns the
project and the app works exactly as before.

Kept here because the reasoning is worth not repeating. From the first deploy
until 11 September the app answered 200 to anyone: `/prospects` rendered business
names with phone numbers and email addresses, paging reached all 7,643 reachable
rows, and every mutating endpoint was open — `contact` logged an outreach,
`decline` added a business to the do-not-contact list, `outcome` recorded a
reply, and `POST /api/searches` ran an Overpass query.

`CLAUDE.md` says "Single user. No auth. No multi-tenancy." That rule is about not
building a users table, and it is right. It is not the same as leaving write
endpoints open to the internet, and the two got conflated for a month. If a
future change makes the app reachable another way — a custom domain, a bypass
token for automation — this is the paragraph to re-read.

What was at risk, in order: other people's contact details, collected from
OpenStreetMap for one person to write to; the learning loop's only data, since
anyone could log sends and outcomes and reply rate is the one thing this project
measures; the queue itself, because `/decline` is not reversible from the UI; and
the cost and courtesy of a free Overpass endpoint anyone could fire.

`app/robots.ts` and a `noindex` were added on 10 September. They stop a search
engine turning this into an indexed contact directory. **They never made it
private** — that is what the setting above does. The deployment URL is
deliberately no longer in `README.md`, since publishing it is the only way anyone
finds it.

## Undoing a decline

"They said no" was the only one-way door in this app: one click behind one
confirmation, and nothing could take it back. Declined rows now carry an **undo**
beside "do not contact", and `POST /api/prospects/<id>/undecline` does the same.

It is not a plain delete of what the decline wrote. Suppression entries are keyed
on the value — the phone number, email and domain — rather than on the prospect,
because a "no" comes from a business rather than from a row. Since 95 rows share
a number with another business, releasing the entry could let someone who
genuinely refused back into the queue.

So an identifier is released only when no other still-declined prospect owns it.
Verified against the real council switchboard that answers for twelve preschools:

```
decline preschool A          -> switchboard suppressed
decline preschool B          -> still suppressed
undo A                       -> released 0, kept 2   (B still refuses)
undo B                       -> released 2           (nobody left holding it)
```

A prospect can therefore come back to the queue and still be unreachable, which
the row says: "Back in the queue, but N identifier(s) stay suppressed."

**Declined rows sort last**, so on a large search the undo is on the final page —
row 2,837 of 2,837 in the twelve-category Cebu search.

## The inbox is empty and you want to know why

```bash
pnpm leads:diagnose
```

Deterministic, no model, no network — it aggregates the score parts the lead page
already computes one lead at a time. Run it whenever the funnel goes quiet.

As of 10 September, over 345 leads:

```
leads: 345 total, 48 in the last 7 days — 171 disqualified, 171 parked,
       0 still in play, 3 drafted or beyond

job leads (322)
  timezone     7.1 / 30   24% of max  zero:  162/322  full:   21
  stack        9.5 / 25   38% of max  zero:  147/322  full:    4
  contract     5.9 / 20   30% of max  zero:    0/322
  pay          5.2 / 10   52% of max  zero:    0/322
```

**The average job lead scores 33 of 100 against a threshold of 75.** That is not
a broken filter. Half the postings score *nothing* on timezone eligibility, and
147 of 322 score nothing on stack — the sources are carrying work that is not
open to someone in UTC+8, in stacks that are not his.

The useful conclusion is about supply, not weights: loosening timezone to clear
the threshold would draft applications to jobs that will not hire from this
timezone, and the rubric already judged those correctly.

**But no single fix is enough, and the headline alone implies otherwise.** The
tool now projects each dimension to full marks:

```
If one dimension were perfect: timezone 56, stack 49, contract 47
No single dimension reaches 75 on its own.
```

Checked against the leads that are already timezone-perfect: the 21 with full
marks average **57**, not 75, and their stack averages 8.0 of 25. So a source
carrying APAC-friendly roles raises the average by roughly 23 points and still
lands short. It has to carry APAC-friendly roles *in his stack* — which is one
adapter, not two, but it is a narrower ask than "more remote jobs".

Postings are also old: `posted_at` is never null, and 119 of 322 are over thirty
days old, which is where 138 freshness zeros come from. Applying to a month-old
posting is low yield whatever it scores.

**It also reports dimensions that rank nothing.** Every one of 23 funding leads
scores 15 of 15 on `pay` — that is a constant lifting every score equally, not a
weight, and the funding rubric is really being decided by the other three. Worth
knowing before anyone tunes a number; not changed here, because weights are a
`memory/RUBRIC.md` decision with a tuning log.

## Writing better first messages

Every prospect message sent so far was the same template with the business name
swapped — `firstMessage()` in `lib/places/contact.ts`. The enhance loop exists to
replace it per business and, until 10 September, had never been run: zero drafts
in the table against sixteen sends.

```bash
pnpm prospects:enhance          # prints a prompt for the top 10 reachable
# paste into Claude Code, get JSON back
cat enhanced.json | pnpm apply:enhance
```

What it writes is an **unsent** `outreach` row at `step = -1`. `sentAt` stays
null, which is what makes it a draft; nothing in the loop can promote one to
sent. `logContact` prefers an accepted draft over the template, so the WhatsApp
or mail link carries the better text once a draft exists.

Two guards worth knowing before writing any: `apply:enhance` rejects the whole
batch if a message claims a signal the prospect does not have, and
`verifyMessage` refuses text that mentions reviews, opening hours, a visit that
did not happen, or being local to them. The batch is all-or-nothing on purpose —
a half-applied set leaves nobody able to say which messages were checked.

**Ten drafts are waiting now** for restaurants, a hotel and a driving school in
Cebu, Mandaue and Lapu-Lapu. Open `✦ Enhance` on a row to see the template and
the draft side by side before sending.

The emitter skips prospects that already have a draft. Without that it hands back
the same ten every run — which is exactly what happened the first time, and the
second prompt came out byte-identical to the first.

## A site signal can be a fact about an error page

**What happened.** An enhanced draft was written telling CDW Studios that
cdwstudios.com has no viewport tag and lists no contact details. The site has
both — a viewport meta tag and `info@cdwstudios.com` with a phone number. The
draft was caught by fetching the site before sending, and deleted.

**Why.** `extractSiteSignals` answers the same shape whatever it is given. A
52-byte body reading `403 - Forbidden | Access to this page is forbidden.`
contains no viewport tag, so it measures `noViewport: true` and finds no
contacts — a fact about an error message, stored as a fact about the business's
website, and then offered to the message writer as something to lean on.

The enricher already refuses a 403 *status*. This was a bad body, and re-running
the same URL the next day returned the correct signals, so it was transient.

**Fixed.** `looksLikePage` in `lib/places/extract.ts`: a body must carry an html
or body tag and clear 200 bytes before anything is measured on it. The test is
loose on purpose — the failure it guards is an error string, not a small site.

**How to spot the fingerprint** in data written before the guard:

```sql
select id, name, website from prospects
where site_signals->>'noViewport' = 'true'
  and site_signals->>'platform' is null;
```

`noViewport: true` with no platform detected is the shape: a real page usually
identifies its platform. Three rows carried it; re-enriching corrected two, and
the third (a Weebly site) genuinely has no viewport tag — verified against the
live page, which is the only way to tell the two apart.

**The rule that follows.** Before a message makes a specific, checkable claim
about someone's website, open the site. The record is evidence, not proof, and
this one was wrong in a way no amount of reading the code would reveal.

## "No website in the record" is a fact about the record

A draft told Leura Wellness they have no website. Their email is at
`leurawellness.com.au`, which serves a 349KB site titled "Leura Wellness".
OpenStreetMap has no website tag for them — so the record was right about itself
and wrong about the business.

`ownDomainFromEmail` closes it. When a prospect has no website on file but emails
from a domain resembling its own name, `buildSignals` withholds `no_website` and
offers `email_domain` instead, naming the domain to check. Withheld rather than
annotated on purpose: `verifyMessage` requires `no_website` for any "you don't
have a website" phrasing, so the claim is now unshippable rather than merely
discouraged. Replaying the deleted message proves it:

```
signals offered: [ 'category', 'email_domain', 'mobile' ]
violations: [ { quote: "don't have a website", ... } ]

with a gmail address, same message -> violations: []
```

**The naive version of this rule is wrong.** Of 117 prospects with a non-free
email domain and no website, most are at `deped.gov.ph` or `unsw.edu.au` — a
department's domain or a university's, not the school's or the clinic's. Those
businesses genuinely have no site. What separates them is resemblance to the
business name, which is what the function tests; ISP mailboxes like
`bigpond.com` are treated as free providers.

**Verifying a batch of drafts.** For each: run `verifyMessage` against
`signalKeys`, and for anything claiming no website, check the email domain and
re-read the row from OpenStreetMap. On the eighteen drafts of 10 September that
found one false claim; the other seventeen came back clean, with OSM confirming
no website for any of them and sixteen of them on free providers.

What this cannot prove is a negative. A business may have a site that
OpenStreetMap has never recorded and whose address gives no hint.

## Verifying drafts against the sites they talk about

```bash
pnpm drafts:verify
```

Read-only. It never edits a draft or a prospect — deciding what to do about a
false claim is a person's job, and deleting someone's drafted work on a heuristic
is not something a script should do unattended. Exits non-zero if any claim is
false.

For every unsent draft it does three things:

1. Runs `verifyMessage` against the prospect's signals. Free, and catches a
   message that drifted from the record.
2. If the message says they have no website and none is on file, checks whether
   their email domain serves a page.
3. If the message makes a claim about a site that *is* on file — no viewport tag,
   no contact details — fetches it and re-measures.

Step 1 alone is not enough, which is the reason this exists: `verifyMessage`
checks a message against the **stored signals**, so a message faithful to a wrong
record passes it. Both false drafts of 10 September did.

Four verdicts, and the last two are not the same thing:

- **false** — the site says otherwise. Delete or rewrite before sending.
- **unverifiable** — a claim nothing available can settle. Not a pass.
- **ok** — a claim checked against the site and found true.
- **no checkable claim** — the message asserts nothing a fetch could decide.

The first run after the drafts were rewritten reported "17 confirmed", which
reads as seventeen claims checked and true. Nothing had been checked. That is the
same error this tool exists to catch, so the verdicts were split.

Verified against both real failures: with the false Leura draft re-planted, the
signal check catches it when the site is on file, and the fetch catches it
independently when it is not — `claims no website, but https://leurawellness.com.au/
serves a page`.

One request per site, a second apart, with the enricher's User-Agent.

## Say what was looked for, not what is true

The first message used to open "I noticed you don't have a website yet". That is
a claim about their business, and the record it rests on comes from
OpenStreetMap, which is frequently just missing one — Leura Wellness got that
sentence while leurawellness.com.au was serving a 349KB site.

It now reads:

> I couldn't find a website for you — most people looking for a Cebu City
> business like yours start on Google. If you have one and I missed it, tell me
> and I'll shut up.

Same information, and it is a fact about the search rather than about them. The
reader is the one person who knows the answer, so getting it wrong in the first
line ends the conversation, while asking costs nothing and invites a reply even
when the guess is wrong.

`verifyMessage` allows the new phrasing without any signal about them — it is not
a claim — but still refuses it when a website *is* on file, because then the
search did find one and the sentence is a false account of what happened.

All seventeen drafts were rewritten the same way. Only the assertion changed; the
per-business half, which is why they were written individually, is untouched.

## The follow-up ladder, checked before it fires

Eighteen sends went out on 9 September and nobody had confirmed the ladder covers
*prospects* as well as leads. Asking `getDueFollowups` with a future date settles
it without waiting:

```
13 Sept 19:31 Manila   first one becomes due
by 15 Sept             18 due — 16 prospects, 2 leads, all at step 1
```

That first moment is a **Sunday evening**. Nothing in the system schedules by
time of day, so the list will simply be full on Monday morning, which is when to
work it — a WhatsApp message to a small business at 7:31pm on a Sunday is not
the same message at 9am on a Monday.

Binary-searching that crossover through `getDueFollowups` rather than computing
it from `sent_at` was deliberate: two hand calculations disagreed because
`sent_at` is stored without a timezone, and the function that decides is the only
authority worth asking.

**A prospect follow-up used to link nowhere useful.** `/prospects` lists only
`status = 'new'` and every row on the follow-up list has been contacted, so all
sixteen links pointed at a page that could not contain them. They now go to
`/prospects?prospect=<id>`, which shows that one business whatever its status,
says why it is not in the queue, and keeps its contact controls.

## What a prospect follow-up actually says

Until 11 September, nothing. `logContact` built every message from
`firstMessage` or an accepted draft whatever the step, so a prospect reaching day
four would have received their opening message again, word for word, from
someone they had already ignored once. Sixteen of those were due on the 13th.

`followUpMessage` writes steps 1 and 2. Deterministic, no model, and it claims
nothing about their business — the opener carries the observation and the risk of
being wrong about it, and repeating that in a follow-up doubles the exposure for
nothing. What it adds instead is smaller and safer: what the page would actually
contain, by trade, and an explicit way out.

- **Day 4** — references the earlier message in one line, gets concrete about the
  offer, ends "Worth a look, or shall I leave it?"
- **Day 11** — says it is the last one. A ladder with an end only works if the
  person on the other side can tell it has ended.

The offer splits on whether they already have a site. "One page showing your
menu" to a restaurant whose website already has a menu reads as not having
looked; those get "I'd mock up one page — … — so you can put it beside what you
have now". Neither version passes judgement on the site they have, because
nothing here can support an opinion about it.

`messageFor` is the rule, extracted so it can be tested without a database: step
0 is the opener (an accepted draft if one exists), every step after it is a
follow-up.

## The follow-up payload is leads only

`pnpm followups` emits what the copywriter has to write. That is not the same
list as `/followups`, and conflating them was a bug waiting for 13 September:
eighteen were due, sixteen of them prospects.

`apply:drafts` lets any id carrying a step past its "awaiting a draft" check —
that is how follow-up leads are allowed in — so a prospect id would have reached
the insert and died on the lead foreign key, taking the daily run with it.

Prospect follow-ups need no model: `followUpMessage` writes them from the trade
and the step when the button is clicked. So the payload is leads only, and the
count difference is announced on stderr rather than left to look like data loss:

```
followups: 16 prospect follow-up(s) are due and not in this payload —
           the app writes those itself, no model needed.
```

Checked against Monday by asking with a future date: 18 due, payload of 2, and
`checkStep` accepts a step-1 draft for both — `highestSent=0`, no unsent draft.

## Refreshing specific rows did not enrich those rows

`refreshProspects({ ids, enrich: true })` marked the requested rows `pending` and
then called `runEnrichment` with **no id filter** — so it enriched whichever rows
topped the global pending queue and left the requested ones sitting at pending.

Harmless while that queue was unordered, because the wrong rows were at least
arbitrary. Ordering the queue by score on 10 September turned it into a reliable
way to re-read the same high-scoring sites over and over while the rows a person
actually asked about were never touched.

Found by re-checking six `no_contact_found` rows and watching four come back
still `pending`. `runEnrichment` takes `ids` now, and `refreshProspects` passes
them.

Worth saying plainly: the row-level re-enrichments done on 10 September — the
CDW Studios signals and two of the three viewport rows — were hitting this bug.
They did produce corrected values, so those rows were reached, but that was luck
rather than targeting. The one conclusion that did not depend on it is the Weebly
site, which was checked against the live page by hand.

**After the fix**, all four stuck rows enriched on request and came back
`no_contact_found` for real: their sites expose no contact details a parser can
find. That verdict was right; only the targeting was broken.

## Two dependencies, and why only two

Eleven libraries were surveyed on 11 September. Two were installed, because this
project's rule is that deterministic code does the bulk work and every dependency
is a thing that can rot.

**`cheerio`** replaced two regular expressions in `lib/places/extract.ts`. Both
had produced real errors:

- `<meta name=viewport content="…">` — valid HTML with an unquoted attribute. The
  regex required quotes, so it answered "no viewport tag", which is the false
  claim that reached a draft about a real company's site.
- `info&#64;clinic.com.au` — a standard dodge against scrapers. The regex read it
  as literal text and found no address, so the business looked unreachable.

**`gpt-tokenizer`** replaced dividing by four in `pnpm tokens:estimate`. The
character rule was close on prose and ran **18% under on JSON**, which is what
this budget guards — optimistic in exactly the direction that hides a regression.
Measured on the real emitters: 282 against 342, and 1,736 against 1,792.

It is still an estimate and still says so. That tokeniser is OpenAI's BPE and the
model reading these payloads is Claude, whose tokeniser is not the same.

**Swapping the parser introduced a bug within the hour.** cheerio's `.text()`
concatenates adjacent elements with nothing between them, so a footer address
beside a "Home" link became `info@cdwstudios.comhomebachelor` — structurally
valid, and `isUsableEmail` would have let it into the table. `stripTags` joins
text nodes with a space now. It was caught by running the change against the real
388KB page rather than the fixtures, which all passed.

Parsing costs about 100ms for three extractors on that page — roughly 15 minutes
across 9,100 pending rows, against a nightly budget of 25.

The nine not installed — `rss-parser`, `robots-parser`, `p-throttle`,
`bottleneck`, `nock`, `msw`, `undici`, `linkedom`, `node-html-parser` — are
conveniences for problems this project does not have yet.

## Social links: 81 of 638 were not links

OpenStreetMap's `contact:facebook` holds a URL or a bare page handle, and both
are common. Stored raw, 81 rows carried values like `@manimokocebu`,
`cdwstudios` and `metrosports.lahug` — the row showed something and clicking it
went nowhere. `normaliseSocial` turns a handle into the URL it is the tail of,
and runs at both write paths: discovery, where these came from, and enrichment,
where scraping finds share buttons and tracking pixels before it finds the
business.

**The dry run earned its keep twice**, and both were errors in my own rule:

- `/p/` is a post on Instagram and a **page** on Facebook.
  `facebook.com/p/Bonenone-Korean-Chicken-100091435368532` is a real business
  page; one shared blocklist would have cleared 89 live links.
- `facebook.com/pages/Pet-Universe/117779078266601` is the older page format, and
  `pages` looked like a platform path.

Final pass over 643 values: **379 rewritten, 58 cleared**. Everything cleared was
genuine junk — `facebook.com/tr` tracking pixels, bare `/people` and
`/profile.php`, and three values in the facebook column that pointed at a
different site entirely. Afterwards every stored facebook value is a real
`https://www.facebook.com/…` URL.

Run a backfill dry first and read what it would discard. Both mistakes above
looked like tidying until the list was printed.

## Enrichment: 364 nights became 46

The backlog was never a fetching-speed problem. Enrichment was a sequential loop
doing 25 rows a night with a second between requests, so 9,100 pending rows were
364 nights away. Parsing a page costs about 100ms; the loop was the constraint.

Two changes, both measured on real sites rather than assumed:

- **Hosts are fetched five at a time** (`p-map`), and rows on the same host still
  run in order. The pause is owed to the host, not to the queue — but two rows
  can share one website, as Easy Solutions Plumbing Sydney and North Shore do,
  and hitting it twice at once is the thing the pause exists to prevent. So the
  queue is grouped by hostname and groups run in parallel.

  ```
  concurrency=1   53730ms for 10 rows (5.4s each)  enriched=4 failed=4
  concurrency=5   10867ms for 10 rows (1.1s each)  enriched=4 failed=4
  ```

  4.9x, same outcomes.

- **The nightly cap is 200, not 25**, with `timeout-minutes: 6` on the step. A
  real run of 20 rows took 24 seconds, so 200 is about four minutes inside a
  fifteen-minute job. The step already had `continue-on-error`, so a slow night
  stops enrichment rather than the run, and the minute bound means the steps
  after it — scoring, keepalive, the report — cannot be starved by it.

9,100 ÷ 200 is roughly 46 nights. Raising it further is a politeness question
before it is a technical one: every one of these is a small business's website.

`concurrency` is an option on `runEnrichment`, defaulting to 5, so a one-off
backfill can be told to go faster or slower without editing the workflow.

## Measuring one prospect's site properly: `pnpm lh`

    pnpm lh <prospectId>          one prospect
    pnpm lh --limit=25            the best unmeasured enriched rows
    pnpm lh <...> --dry           measure and print, store nothing

Runs Lighthouse in a headless Chrome against a prospect's website and merges what
it finds into `siteSignals` under a `lighthouse` key. On demand only. It is not
in the nightly job and should not be added to it.

**Batch mode takes enriched rows only, best score first.** 9,294 scored prospects
have a website and no measurement, and all but 126 of them are still in the
enrichment queue — their site has never been fetched at all. Enrichment is what
establishes that a URL is a real page rather than a parked domain. Measuring
ahead of it would be thirty-eight hours of headless Chrome spent partly on
domains that are for sale, so the queue waits for enrichment to reach them.

**It reads robots.txt**, which it did not at first. The enricher has always
checked, and Lighthouse inherits nothing from it — it launches a browser and
loads whatever URL it is handed. A site owner who wrote `Disallow: /` is a poor
person to cold-email about building them a website.

**"Already measured" is asked of the database, not of a prefetched window.** The
first batch version took `limit * 4` rows ordered by score and filtered them in
JS; it worked once and then quietly shrank, because the best rows get measured
and then fill the window. `--limit=3` returned two. A later `--limit=25` would
have returned none while a hundred rows waited. If a batch returns fewer rows
than asked for, that is now a real answer rather than a bug.

A row whose stored reading was taken on a different host is re-measured and goes
first: that is worse than no reading, because the row looks measured and
describes a server the business no longer uses.

**Why not nightly.** Measured against five real prospect sites before any of it
was written: 12.6 seconds each on the mobile preset, 13.8 on desktop. The cost
is page load plus the audit suite, so the lighter preset buys nothing. Two
hundred sites is 42 minutes against a fifteen-minute job budget that enrichment
already takes four of. One site, right before you write to its owner, is the
only place the cost makes sense.

**Why the score is not stored.** The same site, three consecutive runs, one
browser:

    The Roofing Guy        perf 55, 58, 58   LCP 6.0s, 5.8s, 5.7s
    Lynnette Chu, D.M.D.   perf 48, 56, 52   LCP 5.0s, 8.2s, 8.3s

Eight points and 3.3 seconds of LCP without touching the site, and fifteen
points for that dentist across two sessions an hour apart. Nothing that moves
like that can be said to the person who owns the site.

Diffing every audit across two runs sorted them cleanly. **Moved:**
first-contentful-paint, largest-contentful-paint, speed-index,
total-blocking-time, interactive, unused-css-rules, image-delivery-insight.
**Identical:** total-byte-weight — 10,475 KiB both runs, byte for byte —
unsized-images, color-contrast, link-name, unminified-css, unused-javascript.

Audits that describe the page hold. Audits that describe the clock do not. Only
the first kind is read, by an allow-list in `lib/places/lighthouse-signals.ts`,
so a new Lighthouse version adding another timing audit has to be opted in.

**What it adds that nothing else could.** Enrichment fetches the HTML and never
the subresources, so a 10.5 MB homepage reads to it as three clean booleans:

    { "noHttps": false, "noViewport": false, "hasBookingForm": true }

That was the stored record for a roofing company whose homepage pulls ten and a
half megabytes. Page weight is the one measurement here the rest of the pipeline
has no way to take.

**Where it ends up.** Two signals, both dated and both gated in
`message-verify`.

`page_weight` at 3 MB or above. Below that it is stored but not offered — the
median page is around 2.5 MB, so a 2 MB site is not a thing to open a
conversation with. A draft mentioning megabytes, page weight or slow loading
without that signal is rejected, and any mention of a Lighthouse or PageSpeed
score is rejected whatever the record says.

`contrast` at ten or more failing elements. Across the eleven drafted prospects
with websites the counts were 49, 40, 16, 8, 7, 1, 1 and four zeroes; ten sits in
the gap and separates a broken palette from one muted caption. The count is
solid — three consecutive runs of three sites returned 49, 49, 49 / 40, 40, 40 /
16, 16, 16 — but not quite viewport-independent: Alta Roofing is 40 at phone
width and 39 on a desktop screen. So the fact names the rendering, and a draft
should keep that wording.

`unsized_images` at five or more. Counts across the eleven were 26, 10, 2, 1, 1
and six zeroes, and the low ones say what they are — Efficent AC's two are the
same `logo-color.svg` twice. Five is above anything a header accounts for.

This one is steadier than contrast, because it asks what the markup says rather
than what the render looks like: three phone-width runs and a desktop run gave
26/26/26/26, 10/10/10/10 and 2/2/2/2. So its fact names no rendering. It states
the cause and the consequence — no width or height set, so content below moves —
and never a measured shift: Lighthouse's own layout-shift metric is one of the
volatile ones and is not stored.

Its rule requires a subject. "Jump" alone is how every draft offers a call —
"happy to jump on a call" is already in them — so the pattern only fires when the
page, the content, the text or the images are the thing said to move.

A contrast measurement does **not** license a claim about how the site behaves on
a phone. Forty unreadable elements do not establish that a site is hard to *use*
there; that is the viewport rule's question, and `message-verify` still answers
it separately. Saying "at phone width" passes both rules, "on a phone" does not.

**It survives re-enrichment.** `pnpm enrich` rewrites `siteSignals` wholesale
and would otherwise delete the measurement on the next nightly run, so the block
is carried across. It is kept, not trusted: the block stores the URL it was
measured on, and a reading whose host no longer matches the record is ignored
rather than repeated about a site that has moved.

**If a desktop preset is ever added to the script**, store the viewport with the
reading. Every `contrast` fact says "at phone width", and a desktop run would
make that sentence false without changing a line of code.

**What it found on the drafted list.** All eleven measured 11 September: none
crossed the weight floor (largest was Dresden Vision at 2,371 KiB), three crossed
the contrast floor — Dresden Vision 49, Alta Roofing 40, Fixorvo AC Repair 16 —
and two crossed the unsized-images floor, Fixorvo at 26 and Lynnette Chu at 10.
Fixorvo is the only one carrying both.
Unused JavaScript ran 94 KB to 773 KB on every one of the eleven; it is stored
and deliberately not offered, because it is the theme's doing rather than
anything the owner chose, and it is not something they can see.

**A Windows wart.** `chrome-launcher` fails to delete its own temp profile
directory and throws `EPERM` out of `kill()`. Chrome itself exits; the directory
is left behind. The script swallows that throw, because losing a measured run to
a cleanup error would be absurd.
