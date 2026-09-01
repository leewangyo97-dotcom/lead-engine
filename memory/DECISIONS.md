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

---

## 00X — pnpm build scripts are approved in `pnpm-workspace.yaml`

**Date:** 2026-09-01

pnpm 11 blocks dependency install scripts by default and exits 1 rather than
warning. The approval key is `allowBuilds` in `pnpm-workspace.yaml` — not
`onlyBuiltDependencies`, and not a `pnpm` field in `package.json`. Both of those
are silently ignored, so the install keeps failing with the same error and it
looks like the allowlist is being disregarded.

`esbuild` is approved because vitest and drizzle-kit both need it to unpack its
platform binary. Nothing else is approved. If a future dependency demands a build
script, read what the script does before adding it here — this is the one place
in the repo where installing a package runs arbitrary code.

---

## 00X — stage 2 is gated at 60 and hard-capped at 25 leads

**Date:** 2026-09-01

Two separate limits, for two separate reasons.

**The gate is 60**, derived rather than chosen: the `needs_draft` threshold is 75
and stage 2 may adjust by at most +/-15, so a lead below 60 cannot reach 75 no
matter how well it reads. Sending it to a model spends tokens on a foregone
conclusion. If either number in `memory/RUBRIC.md` changes, the gate moves with
it — it is computed in `prefilter.ts`, not typed in.

**The cap is 25 leads per run.** Stage-2 cost scales with this number and nothing
else. On a good day the gate may pass 60 candidates, and without a ceiling the
bill triples with no one deciding that it should. Overflow parks and is reported
in the run line, so a capped run is visible rather than silent.

Parked leads still get a `scores` row. Phase 6 needs to be able to ask what the
gate turned away; discarding the evidence would make the rubric untunable.

---

## 00X — the UI uses Ember & Paper tokens, not the palette in 04-UI-SPEC.md

**Date:** 2026-09-01

`docs/04-UI-SPEC.md` specifies ground `#EDF1EF`, Archivo, and semantics
`#17734F` / `#8C5D08` / `#5B6C73`. The Ember & Paper foundations wired in Phase 0
specify `paper/200 #F2F1EA`, Instrument Sans, and `go/500 #2F6B4F`. Both agree on
ember `#C2451F` as the accent.

Ember & Paper wins, because it is the palette that exists in the Figma file and
in `app/globals.css`, and because its contrast pairs were computed rather than
estimated — two of its greys were darkened after measuring. Adopting the spec's
palette would mean redoing that work for values with no source.

Everything else in the UI spec is followed as written: the screen list, the
keyboard model, the row anatomy, and the rule that the left stripe is a severity
encoding.

---

## 00X — the draft screen shows nothing rather than a mock

**Date:** 2026-09-01

`/lead/[id]/draft` exists so the `e` shortcut has somewhere to land, but it
renders an explanation instead of a sample email. A screen showing a plausible
fake draft is the most dangerous thing that could be in this repo: the entire
point of the verifier is that no unverified claim reaches a Gmail draft, and a
mock is an unverified claim rendered convincingly.

