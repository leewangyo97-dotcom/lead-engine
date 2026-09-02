# STATE — read this first, every session

**Cap: 150 lines.** When it exceeds that, roll closed items into `DECISIONS.md`
and truncate. This file is read every session; every line costs tokens repeatedly.

Last updated: 2026-09-01 · Phase: **all six complete. First real draft written 2026-09-02.**

## Right now

**The system produced its first outreach draft on 2026-09-02, unassisted.** The
scheduled nightly run harvested This Dot Labs — an AI-native consultancy hiring a
Senior Android Engineer (Kotlin) and a Senior React Native Engineer, remote-first
and global. Pre-score 75, stage 2 took it to 80 for an unusually precise stack
match: those two roles are his two strongest bands, both named.

It is in Gmail, verified, unsent, addressed to jobs@thisdot.co. Joshua reviews
and sends. Draft id r1950667528497554225.

That closes the last open exit test. Every phase now has evidence behind it, and
the funnel has run end to end without anyone deciding to help it.

The working copy is `C:\dev\lead-engine`. `F:\lead-engine` is corrupted NTFS
wreckage awaiting `chkdsk F: /f /r`.

## Next three actions

1. **Read the draft and send it if it is right.** Then log the send on the lead
   detail page — the learning loop measures from `sentAt`, and an unlogged send
   makes every reply rate below it wrong.
2. Run `pnpm nightly` daily. The September thread is filling: 449 raw, 262 leads,
   12 reaching stage 2 on 2 Sep.
3. The contract weight is still open, but less urgently: a full-time posting just
   cleared 75 on stack merit alone. `/rejected` still quantifies the cost —
   1 qualifies today, 6 would if full-time counted as acceptable terms.

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
- 2026-09-02 — First real Gmail draft: This Dot Labs, scored 80, verified,
  written from PROFILE with no invented claims.
- 2026-09-02 — Inbox, lead detail, draft review, empty and loading states built
  to the Figma frames; logo mark implemented from 7:461.
- 2026-09-02 — Runtime docs audited end to end: agent output contracts against
  their schemas, skills against the code, and the copywriter's angle/proof
  vocabulary, which the learning loop groups by and nothing defined.
- 2026-09-02 — F: corrupted; working copy restored to C:\dev\lead-engine.
- 2026-09-01 — Phase 3 exit test passed: two green scheduled runs.
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
