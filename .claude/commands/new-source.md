---
description: Add a new lead source adapter, with fixtures and tests, and register it.
argument-hint: <url or source name>
---

Add a source adapter for: **$ARGUMENTS**

## Before anything

Check `.claude/skills/source-adapter/SKILL.md` for the interface contract, and
`memory/DECISIONS.md` entry 006 — **public sources only**. If the target requires a
login (LinkedIn, Upwork, Work at a Startup), stop and say so. That decision is not
open for reconsideration.

## Steps

Delegate to the `harvester` subagent, which will:

1. Fetch a real response and inspect the **actual** shape. Never assume a schema
   from documentation.
2. Save a trimmed real sample to `lib/sources/__fixtures__/<id>.json`.
3. Write `lib/sources/<id>.ts` implementing `SourceAdapter`.
4. Write `lib/sources/<id>.test.ts` covering normalisation, **hash stability**,
   malformed input, summary truncation, and `isDirect` detection.
5. Register in `lib/sources/index.ts` and insert the `sources` row.
6. Run `pnpm test`, then one live harvest.
7. Run `pnpm audit:titles`. A new feed brings a new vocabulary of job titles, and
   the disqualifier only knows the words already in its list — a "Senior Product
   Manager" once reached the inbox at 67 because nothing matched it.

## Then, here

- Confirm the live run's row count is plausible — hundreds, not three, not 50,000.
- Run `scripts/prefilter.ts` and check how many survive. If this one source pushes
  the nightly survivor count past 25, tighten the rubric threshold **before**
  leaving it enabled. Every extra survivor is a nightly token cost forever.
- Append to `memory/PATTERNS.md` if the source needed an unusual technique.
- Update `memory/STATE.md`.

## Report

Which source, row count from one live run, how many survived pre-filtering, tests
passing. Do not paste HTML or JSON samples.
