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

## A run cost more than expected

```bash
pnpm tokens
```

Exits non-zero over 40,000 for a single run. That is nearly always a filter that
stopped filtering rather than a prompt that grew — check the `survived` column
against its usual value before looking anywhere else.

---

## Before deploying anything

```bash
pnpm gate
```

typecheck, tests, and a production build. It builds into `.next-gate`, so it is
safe to run while `pnpm dev` is up.

The database-backed checks need a scratch branch and are not part of the gate:

```bash
neon branches create --name integration --project-id <id>
INTEGRATION_DATABASE_URL=$(neon connection-string integration --project-id <id> --pooled --database-name neondb) pnpm test:integration
neon branches delete integration --project-id <id>
```

It refuses to run against the database in `DATABASE_URL`, because it truncates
tables.
