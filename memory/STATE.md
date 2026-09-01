# STATE — read this first, every session

**Cap: 150 lines.** When it exceeds that, roll closed items into `DECISIONS.md`
and truncate. This file is read every session; every line costs tokens repeatedly.

Last updated: 2026-09-01 · Phase: **6 — complete. Pipeline proven; funnel is dry.**

## Right now

All six phases are built and the mechanical pipeline has been run against live
data end to end. Two sources are live: `hn-whoishiring` and `remoteok`.

The first real attempt at `/daily-run` found a filter leak: "Founding Growth &
Partnerships Lead" reached the scorer with a pre-score of 63, because the
non-engineering rule matched `sales` but not `growth` or `partnerships`. Fixed
and tested in both directions.

**Nothing currently qualifies.** After the fix, 0 of 28 leads clear the gate of
60. The best is 52 — a kdb+/q contract role, which is worldwide and contract but
matches none of the stack. Everything else is US-only full-time. That is the
filter working, not failing, and it is the honest state: the two live sources
are not producing Kotlin/React Native contract work this week.

## Next three actions

1. Wait a day or two and re-run `pnpm harvest && pnpm prefilter`. The September
   HN thread was not up at the time of writing; RemoteOK turns over daily.
2. When something clears 60, run `/daily-run` for the first genuine end-to-end
   pass. It ends in a real Gmail draft.
3. If a week passes with nothing clearing, the question is the source mix, not
   the rubric. Do not lower the gate to manufacture a lead — that spends tokens
   to email people who were never a fit.

## Blocked

Nothing.

## Open questions for Joshua

- Public or private GitHub repo? Public = unlimited Actions minutes; private =
  2,000/month, which is still plenty. Public also means the code is visible —
  fine, since no secrets are in it, and it doubles as a portfolio piece.
- Resume says "seeking full-time remote"; the tool is built for contract. Which is it?

## Recently done

- 2026-09-01 — `remoteok` adapter added; harvest idempotent across both sources
  (30 raw, 28 unique, 0 inserted on the second run).
- 2026-09-01 — Fixed: BD titles were clearing every hard reject.
- 2026-09-01 — Phase 6: outcome logging, weekly rollup with evidence gates, the
  follow-up ladder, /review and /followups. 10 tests.
- 2026-09-01 — Gmail authorised; token exchange and drafts endpoint verified.
- 2026-09-01 — Phase 5 plumbing: model contracts, payload emitters, apply
  scripts, Gmail draft client, `pnpm tokens`. Untested against a real model.
- 2026-09-01 — Phase 4: inbox, lead detail, draft placeholder, settings.
  Keyboard triage per the UI spec: j/k/enter/e/a/x/f and the ? overlay.
- 2026-09-01 — Nightly workflow green from CI end to end.
- 2026-09-01 — Phase 3: keepalive, report-run and retention scripts; nightly
  workflow fixed to declare the monthly cron its retention job was gated on.
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
