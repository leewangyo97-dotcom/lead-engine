# PATTERNS — conventions this codebase follows

Read before writing new code. Append when a convention emerges; keep entries short.

## TypeScript

- `strict: true`. No `any`. Use `unknown` and narrow.
- Zod schema at every boundary: source responses, model output, API route bodies.
  Infer types from the schema (`z.infer`) rather than declaring them twice.
- No default exports except Next.js pages and layouts, which require them.
- Errors: return `Result<T, E>` from anything that can fail on the harvest path.
  Throwing inside an adapter must never take down the whole run.

## Files and naming

- `lib/sources/<source-id>.ts` — one adapter per file, filename equals `id`
- Tests sit beside the code: `foo.ts` / `foo.test.ts`
- Route handlers stay thin: parse → call `lib/` → respond. No logic in `app/api`.
- Nothing in `lib/` may import from `app/`.

## Database

- Always upsert on a natural key (`contentHash`, `outreach.id`). Never blind insert.
- One batched write per run, not N individual inserts — Neon compute is metered.
- Use the `@neondatabase/serverless` HTTP driver. No long-lived connections.
- Every query that feeds Gmail must filter `verifiedAt IS NOT NULL` in SQL, not in
  application code.

## Model calls

- Never inside a loop. Batch, always.
- Stable prefix first (rubric, profile, schema), variable data last — cache hits
  depend on it.
- `max_tokens` set explicitly on every call.
- Validate output with Zod. On failure, retry **once** with the parse error
  appended, then fail loudly.

## UI

- Server Components by default. `'use client'` only where interaction requires it.
- Colours come from CSS custom properties on `:root`, never literals in components.
- Every list of digits gets `font-variant-numeric: tabular-nums`.
- Keyboard handlers live in one `useKeyboardNav` hook, not scattered per component.

## Testing

- Every adapter needs: a normalisation test, a hash-stability test, and a
  malformed-input test.
- The scoring rubric gets table-driven tests — one row per weight boundary.
- No network in tests. Fixtures in `__fixtures__/`, captured from real responses.

## Commits

- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`
- One phase per branch. Never commit directly to `main` while a phase is open.
