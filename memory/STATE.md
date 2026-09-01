# STATE — read this first, every session

**Cap: 150 lines.** When it exceeds that, roll closed items into `DECISIONS.md`
and truncate. This file is read every session; every line costs tokens repeatedly.

Last updated: 2026-09-01 · Phase: **1 — complete**

## Right now

Phases 0 and 1 are done. Deployed at `lead-engine-one-beige.vercel.app`;
`/api/health` returns 200 with `{ ok: true, db: true }`. The full schema from
`docs/03-DATA-MODEL.md` is migrated to Neon, the `hn-whoishiring` adapter is
live, and `pnpm harvest` is idempotent — 24 rows on the first run, 0 inserted on
the second.

## Next three actions

1. Phase 2: `lib/scoring/disqualify.ts` (region blocklist, non-engineering
   titles, stale listings, contacted-within-90-days, disqualified stacks) and
   `lib/scoring/prescore.ts` from `memory/RUBRIC.md` weights. No model calls.
2. `scripts/prefilter.ts` marks survivors `needs_scoring`. Exit test: fewer than
   25 of a ~400-row harvest reach that status.
3. Add `DATABASE_URL` to GitHub repo secrets so `nightly.yml` can run, then
   Phase 3.

## Blocked

Nothing.

## Open questions for Joshua

- Public or private GitHub repo? Public = unlimited Actions minutes; private =
  2,000/month, which is still plenty. Public also means the code is visible —
  fine, since no secrets are in it, and it doubles as a portfolio piece.
- Resume says "seeking full-time remote"; the tool is built for contract. Which is it?

## Recently done

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
