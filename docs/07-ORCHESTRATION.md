# Orchestration

How the pieces cooperate, and who is responsible for what.

## Two clocks

**Nightly, unattended — GitHub Actions.** Cron `0 20 * * 1-5` UTC = 04:00 Manila.
Harvest, hash, disqualify, pre-score. No model, no cost, no human. Rows land in
Neon marked `needs_scoring`. If it fails, an issue opens; nothing else happens.

**Morning, attended — Claude Code.** Joshua runs `/daily-run`. It reads only the
pre-filtered rows and does the judgment work. Ten minutes, three model calls.

Nothing is scheduled between these. The system has no opinions at 2pm.

## `/daily-run` sequence

```
1. read memory/STATE.md + memory/RUBRIC.md          [main thread, small]
2. SELECT * FROM leads WHERE status='needs_scoring' [expect 15–25 rows]
3. → scorer subagent      ONE batched call, Zod-validated
4. persist scores; anything ≥75 → status='needs_draft'
5. → copywriter subagent  ONE batched call over the survivors
6. → verifier subagent    ONE call; sets verifiedAt or returns violations
7. loop back to 5 ONCE for any lead the verifier rejected; then stop
8. create Gmail drafts for verified rows only
9. write run_metrics; update memory/STATE.md and memory/OUTREACH-LOG.md
10. report: counts, top 3, anything needing action in 48h
```

Steps 3, 5 and 6 are subagents specifically so their bulky context stays out of the
main thread. The orchestrator sees structured summaries, never raw postings.

**Step 7 is bounded on purpose.** One retry. A verifier–copywriter loop that runs
until agreement is a token bonfire, and the second failure is nearly always a
missing proof point rather than bad phrasing — which is a human decision.

## Who does what

| Actor | Owns | Never does |
|---|---|---|
| GitHub Actions | fetch, parse, hash, filter, pre-score | call a model |
| Vercel/Next.js | display, edit, trigger Gmail draft | call a model, run cron |
| `harvester` | write/repair adapters | score or write copy |
| `scorer` | apply the rubric, emit `{id,score,tier,reason}` | write prose |
| `copywriter` | draft emails from PROFILE + trigger + proof-match | invent facts |
| `verifier` | check claims, links, regions | rewrite the email |
| `shipper` | typecheck, test, migrate, deploy | change behaviour |

Overlap here is what causes double work and duplicated tokens. Keep the boundaries.

## Session protocol for build work

**At session start:** read `memory/STATE.md`. That is your context. Do not read
`docs/` unless the task names it. Do not read `DECISIONS.md` unless you are about
to make a choice that might contradict a past one.

**During:** work the top item in STATE. If you discover something that changes a
decision, append to `DECISIONS.md` immediately — not at the end, when you'll forget.

**At session end, always:**
1. Update `memory/STATE.md` — what moved, what's next, what's blocked
2. Append any new convention to `memory/PATTERNS.md`
3. If STATE exceeds 150 lines, roll closed items into `DECISIONS.md` and truncate
4. Run `pnpm typecheck && pnpm test`

A session that ends without step 1 has cost the next session more than it saved.

## Sync points

- **Rubric changes** — edit `memory/RUBRIC.md`, bump `rubricVersion`, log the
  reason in `DECISIONS.md`. Old scores stay interpretable because they carry the
  version they were scored under.
- **Profile changes** — edit `memory/PROFILE.md` and tell `verifier`, since it is
  the source of truth for what may be claimed. Batch these; each edit invalidates
  the cached prompt prefix for that day.
- **New source** — `/new-source <url>`, which runs `harvester`, writes the adapter
  and its tests, and registers it. Never hand-wire an adapter into `harvest.ts`.

## Failure escalation

| Failure | Response |
|---|---|
| One adapter throws | log, continue, mark `sources.lastOk=false` |
| All adapters throw | stop, open issue — likely a network or secret problem |
| Neon over quota | retry once at 60s, then issue. Do not loop |
| Model returns bad JSON | Zod rejects, retry once with the error appended, then fail loudly |
| Verifier rejects twice | leave `status='needs_draft'`, surface in UI for a human |
| `pnpm tokens` > 40k | treat as a failing test — a filter has regressed |

## Weekly rhythm

- **Mon–Fri 04:00** — Actions harvests
- **Mornings** — `/daily-run`, then two minutes of keyboard triage, then send by hand
- **Friday** — `/review`: outcome rollup, one proposed rubric change, accept or dismiss
- **Monthly** — retention job prunes >45-day dead rows; source autopsy runs
