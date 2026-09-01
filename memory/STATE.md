# STATE — read this first, every session

**Cap: 150 lines.** When it exceeds that, roll closed items into `DECISIONS.md`
and truncate. This file is read every session; every line costs tokens repeatedly.

Last updated: 2026-09-01 · Phase: **0 — in progress**

## Right now

Phase 0 skeleton is checked in: Next.js 15 App Router + TypeScript + Tailwind,
Drizzle + `@neondatabase/serverless`, `typecheck` / `test` / `db:migrate` wired,
`/api/health` proving the Neon connection. Neon project `jolly-hall-10660362`
is linked on branch `production`; migration `0000_yummy_hex` is applied there and
`runs` exists. `pnpm typecheck`, `pnpm test` and `pnpm build` are all green
locally. The only thing left in Phase 0 is the Vercel deploy. Ember & Paper foundations are wired as
CSS variables (`app/globals.css`) and a Tailwind theme, both derived from
`docs/design/00-LEAD-ENGINE-FOUNDATIONS.md` and cross-checked against the Figma
variables on node `5:252`.

## Next three actions

1. Set `DATABASE_URL` in Vercel for Production, Preview and Development, deploy
   to Hobby, and confirm `/api/health` returns `{ ok: true }` on the deployed URL.
   **Do not add `crons` to `vercel.json`.**
2. Add `DATABASE_URL` to GitHub repo secrets — `nightly.yml` already reads it.
3. Start Phase 1: full schema from `docs/03-DATA-MODEL.md`, then the
   `hn-whoishiring` adapter and `scripts/harvest.ts`.

## Blocked

Nothing.

## Open questions for Joshua

- Public or private GitHub repo? Public = unlimited Actions minutes; private =
  2,000/month, which is still plenty. Public also means the code is visible —
  fine, since no secrets are in it, and it doubles as a portfolio piece.
- Resume says "seeking full-time remote"; the tool is built for contract. Which is it?

## Recently done

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
