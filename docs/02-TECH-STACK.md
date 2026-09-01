# Tech Stack — verified free tiers

Every quota below was checked against the vendor's own docs in September 2026.
Re-check before relying on them; free tiers move.

## The stack

| Layer | Choice | Free-tier reality |
|---|---|---|
| Framework | Next.js 15 (App Router), TypeScript, React 19 | — |
| Hosting | **Vercel Hobby** | Free. **Non-commercial personal use only.** 300s max function duration, 100 deployments/day, 200 projects |
| Database | **Neon Postgres, Free plan** | 0.5 GB storage/project, 100 CU-hours/project/month, 10 branches/project, 5 GB/month egress. Autosuspends after 5 min idle (not disableable) |
| ORM | Drizzle ORM + drizzle-kit | Schema lives in one file — cheap for a model to read, unlike generated Prisma clients |
| Scheduler | **GitHub Actions** | Unlimited minutes on public repos; 2,000 min/month on private for Free accounts. Any cron interval |
| Styling | Tailwind CSS v4 + shadcn/ui | Copy-in components, no runtime dep |
| Email | **Gmail API** (`users.drafts.create`) | Free. 1B quota units/day; a draft costs ~10 |
| Headless fetch | Playwright, only inside Actions | Free on the runner. Never on Vercel — exceeds Hobby limits |
| Validation | Zod | Doubles as the model's structured-output contract |
| Tests | Vitest | — |
| Errors | Sentry free (optional) | 5k errors/month |
| Cache/locks | Upstash Redis free (optional) | 10k commands/day. Only add if you need run locking |

**Total: $0/month.**

## The three traps

### 1. Vercel Hobby cron is once per day, ±59 minutes

From Vercel's own docs: Hobby is *"limited to cron jobs that run once per day"* and
*"Vercel cannot assure a timely cron job invocation"* — a `0 1 * * *` job fires
anywhere between 1:00 and 1:59. A more frequent expression **fails at deploy time**.

**Consequence:** the scheduler is GitHub Actions, not Vercel. Vercel hosts the UI
and API only. Do not put `crons` in `vercel.json`.

### 2. Vercel Hobby forbids commercial use

Vercel's fair-use guidelines restrict Hobby to non-commercial, personal use. This
project is a personal tool, so it qualifies. The moment it becomes something other
people pay for, it needs Pro at $20/month. Know which side of that line you're on.

### 3. Neon scales to zero and cannot be told not to

Compute suspends after 5 minutes idle on Free. First query after idle pays a
cold start (typically sub-second, occasionally a few seconds). Design for it:

- Use `@neondatabase/serverless` (HTTP driver) — no pooler needed, no idle connections
- Never hold a connection open between requests
- The nightly job should do one batched write, not 400 individual inserts

**Budget check:** 100 CU-hours at the 0.25 CU minimum is ~400 active hours/month.
A nightly 5-minute job plus daily dashboard use lands near 5 hours. You have room.
Storage: ~2 KB/lead means 0.5 GB holds roughly 250,000 leads. You will hit the
45-day retention rule long before that.

## Why not the obvious alternatives

- **Supabase** — fine, but you only need Postgres, and Neon's branching makes
  migration testing free. No need for its auth or storage in a single-user app.
- **Vercel Cron + Pro** — $20/month to solve a problem GitHub Actions solves free.
- **Prisma** — the generated client is large and the schema is verbose. Drizzle's
  schema file is compact, which matters when a model reads it every session.
- **Inngest / Trigger.dev** — excellent, but another account, another dashboard,
  another free tier to track. Actions is already where the code lives.
- **Resend** — you'd need it to *send*. This system only drafts, so Gmail API is
  enough and avoids warming a sending domain entirely.

## Environment variables

```
DATABASE_URL=              # Neon pooled connection string
GOOGLE_CLIENT_ID=          # OAuth desktop app
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=      # obtained once, locally, via scripts/gmail-auth.ts
CRON_SECRET=               # shared secret; Actions sends it, API route checks it
```

Gmail scope needed: `https://www.googleapis.com/auth/gmail.compose` — this permits
creating drafts and **cannot send**. Use it rather than `gmail.modify`; the narrower
scope is a structural guarantee that the rule in CLAUDE.md holds.
