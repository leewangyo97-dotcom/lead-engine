# STATE — read this first, every session

**Cap: 150 lines.** When it exceeds that, roll closed items into `DECISIONS.md`
and truncate. This file is read every session; every line costs tokens repeatedly.

Last updated: 2026-09-01 · Phase: **4 — complete**

## Right now

Phases 0-4 are done. The nightly workflow ran green end to end from CI on
2026-09-01 (dispatch), writing to Neon with nobody at a terminal.

The UI is built: inbox with keyboard triage, lead detail with the rubric
breakdown, a draft-review placeholder, and read-only settings. All four render
200 against live data.

Phase 3's exit test is the only thing still open, and it finishes itself —
it wants two *scheduled* runs, not dispatched ones.

## Next three actions

1. Watch the 20:00 UTC cron go green twice. Nothing to do but look.
2. Phase 5: `lib/model/`, Gmail OAuth with `gmail.compose` only, and
   `/daily-run`. This is the first phase with model calls in it — read
   `docs/05-TOKEN-BUDGET.md` before writing any of it.
3. Decide the settings question: rubric weights live in `memory/RUBRIC.md`, a
   file, so editable sliders need either a write path into the repo or a second
   source of truth. See the note in `app/settings/page.tsx`.

## Blocked

Nothing.

## Open questions for Joshua

- Public or private GitHub repo? Public = unlimited Actions minutes; private =
  2,000/month, which is still plenty. Public also means the code is visible —
  fine, since no secrets are in it, and it doubles as a portfolio piece.
- Resume says "seeking full-time remote"; the tool is built for contract. Which is it?

## Recently done

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
