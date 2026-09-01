# STATE — read this first, every session

**Cap: 150 lines.** When it exceeds that, roll closed items into `DECISIONS.md`
and truncate. This file is read every session; every line costs tokens repeatedly.

Last updated: 2026-09-01 · Phase: **6 — complete. Pipeline proven; funnel is dry.**

## Right now

All six phases are built, deployed and running unattended. Nothing is in flight.

Verified against real infrastructure, not assumed: the nightly workflow runs
green from CI; Gmail creates and deletes a draft (`pnpm gmail:smoke`); the
verified-only gate refuses an unverified row and admits a verified one; and the
draft/verify write path has nine integration assertions (`pnpm test:integration`,
scratch branch required).

The one thing that has never happened is a real outreach draft. No lead has
scored 75 on merit. Current funnel: 164 harvested, 41 disqualified, 117 parked,
6 waiting at needs_scoring — and those 6 were already judged and parked once, so
re-scoring them will reach the same answer.

## Next three actions

1. **Answer the contract vs full-time question.** PROFILE.md records it as an
   unresolved inconsistency and it is now the binding constraint: contract terms
   are 20 points, so a full-time-only posting cannot reach 75 however good it is.
   Atria sits at 68 — worldwide, direct contact, React — held back by nothing
   else. Answering it is one weight in `memory/RUBRIC.md` plus a version bump.
2. Run `pnpm nightly` daily for a fortnight and let the September threads fill.
   One thin week is not a fair sample of the sources.
3. Then decide on Launch HN. Stage 2 has rejected four of four founder leads as
   deep-tech with no app surface. If that holds over a fortnight, filter the
   domain in code; four is not evidence yet.

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
- 2026-09-01 — Integration check for the draft/verify/Gmail-gate write path;
  its guard is identity, after two row-count heuristics failed opposite ways.
- 2026-09-01 — Adapters given a 15s timeout and retry; `pnpm gate`;
  `pnpm log:outreach` regenerates OUTREACH-LOG from the database.
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
