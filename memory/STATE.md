# STATE — read this first, every session

**Cap: 150 lines.** When it exceeds that, roll closed items into `DECISIONS.md`
and truncate. This file is read every session; every line costs tokens repeatedly.

Last updated: 2026-09-01 · Phase: **5 — code complete, Gmail unauthorised**

## Right now

Phases 0-4 are done. Phase 5's plumbing is written and tested, but it has never
run end to end, because two things it needs cannot be done from a terminal
session: Google OAuth consent, and the model calls themselves.

What exists: Zod contracts for score/draft/verify, payload emitters that project
fields rather than selecting rows whole, three apply-scripts that validate before
writing, the Gmail draft client, and `pnpm tokens`.

What has never executed: any model call, and anything touching Gmail.

## Next three actions

1. Create a Google Cloud OAuth client (Web application, redirect
   `http://localhost:53682/callback`), put the id and secret in `.env.local`,
   then `pnpm gmail:auth`.
2. Run `/daily-run` for real. There is exactly one lead at `needs_scoring`, so
   this is a cheap first pass — expect well under the 25k target.
3. Phase 6: outcome logging, the weekly rollup, and the follow-up ladder.

## Blocked

Phase 5's exit test needs Gmail authorised. Nothing else is blocked.

## Open questions for Joshua

- Public or private GitHub repo? Public = unlimited Actions minutes; private =
  2,000/month, which is still plenty. Public also means the code is visible —
  fine, since no secrets are in it, and it doubles as a portfolio piece.
- Resume says "seeking full-time remote"; the tool is built for contract. Which is it?

## Recently done

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
