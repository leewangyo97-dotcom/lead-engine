# DECISIONS — append-only

Do not read this file at session start. Read it when you are about to make a
choice that might contradict one already made. Never edit an entry; supersede it
with a new one that references the old.

Format: `## NNN — Title` / Date / Decision / Why / Consequences / Supersedes.

---

## 001 — GitHub Actions is the scheduler, not Vercel Cron
**2026-09-01**

**Decision:** All scheduled work runs in GitHub Actions. `vercel.json` contains no
`crons` key.

**Why:** Vercel Hobby caps cron at once per day and cannot guarantee timing — a
`0 1 * * *` job fires anywhere in the 1am hour, and any more frequent expression
fails at deploy. Actions gives unlimited minutes on public repos (2,000/month
private) at any interval, for free.

**Consequences:** Secrets exist in two places. Actions needs its own `DATABASE_URL`.
The repo must stay active or GitHub disables scheduled workflows after 60 days —
handled by a keepalive write in the workflow.

---

## 002 — Claude runs locally in Claude Code, not server-side
**2026-09-01**

**Decision:** No Anthropic API key in the system. Actions does mechanical work
only; Joshua runs `/daily-run` in Claude Code for scoring and drafting.

**Why:** Zero marginal cost on an existing subscription. It also keeps a human in
the loop at exactly the point where judgment matters.

**Consequences:** The system is not fully autonomous — leads sit in `needs_scoring`
until he runs the command. Accepted deliberately. If this ever changes, it is one
adapter in `lib/model/`; the funnel is unaffected.

---

## 003 — Drafts only. There is no send path.
**2026-09-01**

**Decision:** The system creates Gmail drafts and stops. The OAuth scope is
`gmail.compose`, which cannot send.

**Why:** Auto-sent cold email is why cold email doesn't work, and it risks
rate-limiting Joshua's personal Gmail. Choosing the narrower scope makes the rule
structural rather than a convention someone later "improves" away.

**Consequences:** Sending is manual, every time. That is the feature.

---

## 004 — Single user. No auth, no `users` table.
**2026-09-01**

**Decision:** One hardcoded user. No accounts, no tenancy, no billing.

**Why:** Vercel Hobby forbids commercial use, so this cannot be a product without a
plan change anyway. Single-user removes an entire category of work.

**Consequences:** Going multi-user later means adding `user_id` throughout and real
auth — a real migration, knowingly deferred.

---

## 005 — Drizzle over Prisma
**2026-09-01**

**Decision:** Drizzle ORM.

**Why:** The schema is one compact file a model can read cheaply every session.
Prisma's generated client is large and its schema verbose, which is a recurring
token cost in a project where a model reads the schema constantly.

**Consequences:** Fewer batteries included. Migrations via drizzle-kit.

---

## 006 — Public sources only
**2026-09-01**

**Decision:** No scraping behind logins — no LinkedIn, no Upwork, no
Work at a Startup.

**Why:** Against their terms, and it puts Joshua's real accounts at risk. The
public sources (HN, RemoteOK, funding wires) already produce more than he can
action in a week.

**Consequences:** Some leads are unreachable by the tool. He can add them by hand.
