# PATTERNS — conventions this codebase follows

Read before writing new code. Append when a convention emerges; keep entries short.

## TypeScript

- `strict: true`. No `any`. Use `unknown` and narrow.
- Zod schema at every boundary: source responses, model output, API route bodies.
  Infer types from the schema (`z.infer`) rather than declaring them twice.
- No default exports except Next.js pages and layouts, which require them.
- Errors: return `Result<T, E>` from anything that can fail on the harvest path.
  Throwing inside an adapter must never take down the whole run.

## Files and naming

- `lib/sources/<source-id>.ts` — one adapter per file, filename equals `id`
- Tests sit beside the code: `foo.ts` / `foo.test.ts`
- Route handlers stay thin: parse → call `lib/` → respond. No logic in `app/api`.
- Nothing in `lib/` may import from `app/`.

## Database

- Always upsert on a natural key (`contentHash`, `outreach.id`). Never blind insert.
- One batched write per run, not N individual inserts — Neon compute is metered.
- Use the `@neondatabase/serverless` HTTP driver. No long-lived connections.
- Every query that feeds Gmail must filter `verifiedAt IS NOT NULL` in SQL, not in
  application code.

## Model calls

- Never inside a loop. Batch, always.
- Stable prefix first (rubric, profile, schema), variable data last — cache hits
  depend on it.
- `max_tokens` set explicitly on every call.
- Validate output with Zod. On failure, retry **once** with the parse error
  appended, then fail loudly.

## UI

- Server Components by default. `'use client'` only where interaction requires it.
- Colours come from CSS custom properties on `:root`, never literals in components.
- Every list of digits gets `font-variant-numeric: tabular-nums`.
- Keyboard handlers live in one `useKeyboardNav` hook, not scattered per component.

## Testing

- Every adapter needs: a normalisation test, a hash-stability test, and a
  malformed-input test.
- The scoring rubric gets table-driven tests — one row per weight boundary.
- No network in tests. Fixtures in `__fixtures__/`, captured from real responses.

## Commits

- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`
- One phase per branch. Never commit directly to `main` while a phase is open.

## Scripts load `.env.local` in-process, never via a runner flag

`tsx --env-file=.env.local` does **not** forward the flag to the Node process tsx
spawns. The variable never arrives and the script fails claiming `DATABASE_URL`
is unset, which reads like a missing secret rather than a missing flag. Use
`loadLocalEnv()` from `lib/env.ts` as the first line of any script's `main()`.
In CI there is no file and the value comes from the environment, so it no-ops.

## `onConflictDoNothing`, never `onConflictDoUpdate`, on `leads`

A row that already exists has been filtered, possibly scored, possibly drafted.
Rewriting it on a re-harvest would reset that work. The content hash is stable
precisely so the conflict branch is the common one — see the Phase 1 exit test.

## Dedupe within the batch before the insert

The same posting can appear twice in one fetch. Postgres rejects a batch insert
carrying two identical conflict targets, so `harvest.ts` collapses rows through a
`Map` keyed by hash first. Without it the whole run fails on a duplicate rather
than skipping one row.

## Policy constants live in `lib/`, never in a script

Every script in `scripts/` calls `main()` at the top level, so importing one
runs it. A test that imported `scripts/retention.ts` for its status list issued
a live `DELETE` against whatever `DATABASE_URL` pointed at. Constants a test or
another module needs go in `lib/`; the script imports them.

## `report-run.ts` exits non-zero when a source failed

An adapter that returns nothing still exits 0, so without an explicit check the
workflow stays green while the pipeline starves. The funnel line is printed for
a human, but the exit code is what actually surfaces a broken source.

## Adapters never call `fetch` directly

`lib/sources/fetch-json.ts` is the only place a source touches the network. It
adds a 15-second timeout and retries 5xx, 429 and network errors three times with
backoff; 4xx is raised immediately, because a 404 will be a 404 on the next
attempt too.

Two failures it prevents. `fetch` has no default timeout, so a source that
accepts a connection and stalls holds the nightly job until GitHub kills it at 15
minutes, taking every later adapter with it. And a single 502 would otherwise
mark a source failed, which makes `report-run` exit non-zero — a run that goes
red for reasons nobody caused stops being read, and then a real failure is missed
as well.

## A destructive script is guarded by identity, not by row counts

`integration-check.ts` truncates tables, so it must never see production. Two
size heuristics were tried and both were wrong, in opposite directions: "refuse
if the outreach table has rows" waved production straight through, because
production's outreach table is also empty; "refuse if there are more than 50
leads" then blocked every legitimate scratch branch, because a Neon branch is a
copy of production and starts with all of its rows.

The check that holds is `INTEGRATION_DATABASE_URL !== DATABASE_URL`. Row counts
describe the data; only identity describes which database it is.

