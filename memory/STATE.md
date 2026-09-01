# STATE — read this first, every session

**Cap: 150 lines.** When it exceeds that, roll closed items into `DECISIONS.md`
and truncate. This file is read every session; every line costs tokens repeatedly.

Last updated: 2026-09-01 · Phase: **6 — complete. Pipeline proven; funnel is dry.**

## Right now

All six phases are built, CI gates every push, and the mechanical pipeline is
correct and verified. What it has never produced is a lead worth emailing.

Current funnel: 144 harvested, 41 disqualified, 100 parked, 3 reaching stage 2,
0 clearing 75.

Three defects were found by running it rather than by reading it: the harvest
window was 21 days against a filter that accepts 45; HN titles were whatever
field happened to be second ("Earth", "Full-time", a bare URL); and a
disqualified language in a role's own name did not hard-reject.

A source survey (see DECISIONS) established that the free feeds structurally do
not carry contract work with a named human contact. That is 30 of the rubric's
100 points, so the funnel is not going to produce a 75 from these sources.

## Next three actions

1. **Joshua's call:** either add `funding-wire` with rubric weights for
   `kind: 'funding'` (founders, not HR pipelines — where contract work actually
   originates), or accept that the tool surfaces fewer, better leads and wait
   for the September threads to fill. Do not add another job board; the survey
   says why.
2. Run `pnpm nightly` daily either way. The September HN thread was empty on the
   1st and fills through the month.
3. When something clears 75, `/daily-run` finishes the one path never proven:
   draft, verify, Gmail.

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
