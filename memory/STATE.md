# STATE — read this first, every session

**Cap: 150 lines.** When it exceeds that, roll closed items into `DECISIONS.md`
and truncate. This file is read every session; every line costs tokens repeatedly.

Last updated: 2026-09-01 · Phase: **2 — complete**

## Right now

Phases 0-2 are done. Deployed at `lead-engine-one-beige.vercel.app`. The whole
mechanical pipeline runs and contains no model calls: `pnpm harvest` is
idempotent, and `pnpm prefilter` hard-rejects, pre-scores and gates.

Live numbers on the August HN thread: 24 harvested, 7 disqualified, 16 parked,
1 promoted to `needs_scoring`. That thread is mostly US-only full-time work, so
one survivor is the filter working, not the filter broken — the top parked rows
sit at 52 and 49, held back by US-only scope and no contract option.

## Next three actions

1. Add `DATABASE_URL` to GitHub repo secrets. Nothing in Phase 3 runs without it.
2. Phase 3: `scripts/keepalive.ts` and `scripts/report-run.ts` — `nightly.yml`
   already calls both and will fail on schedule until they exist.
3. Watch two green scheduled runs, then start Phase 4 against `docs/04-UI-SPEC.md`.

## Blocked

Nothing.

## Open questions for Joshua

- Public or private GitHub repo? Public = unlimited Actions minutes; private =
  2,000/month, which is still plenty. Public also means the code is visible —
  fine, since no secrets are in it, and it doubles as a portfolio piece.
- Resume says "seeking full-time remote"; the tool is built for contract. Which is it?

## Recently done

- 2026-09-01 — Phase 2: `disqualify.ts`, `prescore.ts`, `scripts/prefilter.ts`,
  13 tests. Exit test passes: 1 of 24 reaches `needs_scoring`.
- 2026-09-01 — Phase 1: full schema migrated, `hn-whoishiring` adapter, stack
  canonicaliser, `scripts/harvest.ts`, 10 tests. Exit test passes — second
  harvest inserts 0 rows.
- 2026-09-01 — Vercel deploy live, `/api/health` green.
- 2026-09-01 — Neon linked, first migration applied, Neon MCP registered in
  `.mcp.json`, Neon agent skills vendored into `.claude/skills/`.
- 2026-09-01 — Phase 0 skeleton: app shell, Drizzle client, migrate script,
  `runs` table for the Phase 3 keepalive, design-token layer, Vitest wired.
- 2026-09-01 — Spec written: plan, architecture, stack, data model, UI, token
  budget, features, orchestration. Agents, skills and memory bank defined.

## Reminders that bite

- Vercel Hobby cron is **once per day, ±59 min** — the scheduler is GitHub Actions
- Vercel Hobby is **non-commercial only**
- Neon autosuspends at 5 min idle and cannot be told not to; use the HTTP driver
- Phases 1–3 contain **zero** model calls. Keep it that way.
- `contentHash` stability is the single biggest cost lever — its test is not optional
