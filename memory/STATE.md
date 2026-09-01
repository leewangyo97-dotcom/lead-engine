# STATE — read this first, every session

**Cap: 150 lines.** When it exceeds that, roll closed items into `DECISIONS.md`
and truncate. This file is read every session; every line costs tokens repeatedly.

Last updated: 2026-09-01 · Phase: **6 — complete. Pipeline proven; funnel is dry.**

## Right now

All six phases built, deployed, and running unattended. Nothing in flight.

166 leads across three sources. 5 reach stage 2; none scores 75 on merit, so no
outreach draft has ever been written. That is the whole of what is unfinished.

Since the last checkpoint the work has been operational rather than functional —
every item below was found by running the thing, not by reading it:

- one failed Algolia page was silently discarding up to 79% of a harvest
- the score breakdown showed job maxima against founder scores ("25 / 10")
- the UI still promised features that had already shipped
- rows were openable only by double-click; the disqualify prompt was invisible
  to screen readers
- 155 of 161 leads were unviewable, and the disqualify reason was computed then
  thrown away

Monitoring now covers four silent failures — a source erroring, all sources
silent, one source silent, the scheduler stopping — each tested and each having
fired at least once for real. Further alerting would be speculative.

## Next three actions

1. **The contract weight.** `/rejected` now quantifies the two constraints:
   31 of 41 hard rejections are `onsite_no_contract`, and the survivors stall at
   68 because contract terms are worth 20 points. PROFILE.md still records
   full-time vs contract as unresolved. One weight plus a version bump.
2. Run `pnpm nightly` daily. The September HN thread was not posted as of
   1 Sep 15:30 UTC; it fills through the month.
3. Leave Launch HN alone for a fortnight. Stage 2 has rejected four of four as
   deep-tech with no app surface — a pattern, not yet evidence.

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
- 2026-09-01 — Operational hardening: per-source raw counts, fault/warning
  split, /rejected view, fetch timeouts and retries, pagination recovery.
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
