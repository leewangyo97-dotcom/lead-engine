# STATE — read this first, every session

**Cap: 150 lines.** When it exceeds that, roll closed items into `DECISIONS.md`
and truncate. This file is read every session; every line costs tokens repeatedly.

Last updated: 2026-09-01 · Phase: **all six complete. Every exit test passed except a real draft.**

## Right now

**The working copy is `C:\dev\lead-engine`.** `F:\lead-engine` suffered NTFS
corruption on 2026-09-02 — 91 tracked files zero-filled, 51 missing, some turned
into undeletable directory entries dated 1601, and git's object store unreadable.
Nothing was lost: every commit was already pushed, and the tree was restored from
the remote. What remains on F: cannot be deleted until `chkdsk F: /f /r` runs.

Phase 3's exit test passed on 2026-09-01: two scheduled runs, both green,
unattended. The weekday cron harvested (382 raw, 26 new, 18 survived, 1 to stage
2) and the monthly cron ran retention — each correctly skipping the other's job,
which is the `if:` gating that was broken until the monthly cron was declared.

Every phase exit test now passes except one, and it is not a test the system can
pass alone: no lead has scored 75 on merit, so no outreach draft has ever been
written *because the system decided to write one*.

The chain itself is proven. On 2026-09-02 the full path — copywriter,
apply-drafts, verifier, apply-verdicts, create-gmail-drafts — was rehearsed on a
scratch branch against a real lead (Atria, 68) with the contact swapped to
Joshua's own inbox. The draft was created, read back from Gmail with its em
dashes and quotes intact, and deleted; the branch was dropped and production was
confirmed untouched (outreach=0, Atria still needs_scoring with its real
contact).

Two caveats worth keeping: the same session wrote and verified the draft, which
is not the adversarial separation /daily-run uses, and Atria scored 68, so this
was a rehearsal rather than a lead that earned an email.

## Next three actions

1. `chkdsk F: /f /r`, then `rmdir /s /q F:\lead-engine`. Until then the wreck
   sits there looking like a project.
2. **The contract weight.** `/rejected` quantifies it: 1 lead qualifies today, 6
   would if full-time counted as acceptable terms. One weight in
   `memory/RUBRIC.md` plus a version bump. PROFILE.md still records the
   full-time-vs-contract question as unresolved.
3. Run `pnpm nightly` daily. The September thread is filling — 447 raw items and
   36 leads scoring 50+ as of 2 Sep.

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
