# Lead Engine — START HERE

A personal lead-generation engine for Joshua Senining. Harvests contract and
founder leads nightly, scores them against a fixed profile, drafts outreach emails
into Gmail for human review.

**Cost: $0/month.** Vercel Hobby + Neon free + GitHub Actions + Gmail API.

---

## How to use this with Claude Code

```bash
mkdir lead-engine && cd lead-engine
# copy this whole folder in, then:
git init && git add -A && git commit -m "chore: spec"
claude
```

Then say:

> Read CLAUDE.md and memory/STATE.md, then start Phase 0 from docs/00-PLAN.md.

That's it. Everything Claude Code needs is in the files below, and the plan is
sequenced so each phase ends with something that works.

---

## What's here

```
CLAUDE.md                   ← project constitution, loaded every session
README.md                   ← this file

docs/
  00-PLAN.md                6 phases, each with an exit test
  01-ARCHITECTURE.md        the two-runtime split and why
  02-TECH-STACK.md          verified free-tier quotas + the three traps
  03-DATA-MODEL.md          complete Drizzle schema
  04-UI-SPEC.md             screens, keyboard map, visual direction
  05-TOKEN-BUDGET.md        the 12 rules that cut cost ~98%
  06-FEATURES.md            9 features, ranked, + what was rejected
  07-ORCHESTRATION.md       who does what, session protocol, failure policy

memory/                     the memory bank
  PROFILE.md                ★ only permitted source of claims about Joshua
  RUBRIC.md                 scoring weights, versioned
  STATE.md                  read first every session · cap 150 lines
  DECISIONS.md              append-only, 6 decisions already recorded
  PATTERNS.md               code conventions
  OUTREACH-LOG.md           angles, standing rules

.claude/
  agents/                   harvester · scorer · copywriter · verifier · shipper
  skills/                   token-discipline · lead-scoring · outreach-writing
                            source-adapter · memory-bank
  commands/                 /daily-run · /new-source · /checkpoint

.github/workflows/
  nightly.yml               the scheduler
```

---

## The five things that matter most

**1. The scheduler is GitHub Actions, not Vercel.** Vercel Hobby caps cron at once
per day with ±59 minutes of drift, and a more frequent expression fails at deploy.
Do not put `crons` in `vercel.json`.

**2. Phases 1–3 contain zero model calls.** Get the free mechanical pipeline right
first. A leaky filter isn't a small problem you fix later — it *is* the running cost.

**3. The model only sees what needs judgment.** ~400 raw listings become ~18 rows
that reach a model. That's the difference between 1.6M tokens a night and 22k.

**4. `PROFILE.md` is the only source of claims.** The `verifier` agent traces every
factual assertion in every email back to a quotable line. This exists to prevent
one specific disaster: an invented metric in an email to someone who later
interviews you.

**5. There is no send button.** The Gmail scope is `gmail.compose`, which
structurally cannot send. Drafts only, human sends. That's the feature.

---

## Two decisions still open

Both are logged in `memory/STATE.md` under Open questions:

- **Public or private repo?** Public = unlimited Actions minutes and it doubles as
  a portfolio piece. Private = 2,000 min/month, still ample. No secrets live in the
  code either way.
- **Contract or full-time?** The resume says "seeking a full-time remote role"; this
  tool is built for contract. Pick one and make the resume match.

---

## First session checklist

- [ ] Neon project created, `DATABASE_URL` in `.env.local`
- [ ] Vercel project linked, Hobby plan
- [ ] GitHub repo created, secrets added
- [ ] Google Cloud project + OAuth client, scope `gmail.compose` **only**
- [ ] `pnpm create next-app` and Phase 0 exit test passing
