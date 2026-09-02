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
