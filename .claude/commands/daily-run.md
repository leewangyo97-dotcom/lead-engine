---
description: Score, draft and verify today's leads, then create Gmail drafts. The morning routine.
---

Run the morning pipeline. Target: under 25,000 tokens, three model calls, ten minutes.

## Steps

1. Read `memory/STATE.md` and `memory/RUBRIC.md`. Nothing else yet.

2. Get the scoring payload:
   ```bash
   pnpm leads:scoring > /tmp/leads.json
   ```
   It emits projected fields only — never the raw posting. It refuses to run
   above 40 rows, because that means the pre-filter has regressed and the fix is
   there, not here.

3. Delegate to the `scorer` subagent. **One batched call** with all rows. Feed
   its JSON straight back:
   ```bash
   cat scores.json | pnpm apply:scores
   ```
   That validates against the Zod schema, rejects ids not awaiting scoring, and
   promotes at 75 or parks. The threshold lives in code, not in the prompt.

4. Get the drafting payload for the survivors, and anything the follow-up
   ladder owes today:
   ```bash
   pnpm leads:drafting > /tmp/drafts-in.json
   pnpm followups > /tmp/followups.json
   ```
   Both go into the **same** copywriter call. A follow-up is a draft; splitting
   them doubles the prompt overhead to no benefit.

5. Delegate to the `copywriter` subagent. One batched call. Persist with:
   ```bash
   cat drafts.json | pnpm apply:drafts
   ```
   `angle` and `proofUsed` are required by the schema — a draft missing either
   teaches the learning loop nothing, so it is rejected rather than stored.

6. Delegate to the `verifier` subagent. One call. Apply with:
   ```bash
   cat verdicts.json | pnpm apply:verdicts
   ```
   This is the only writer of `verifiedAt` anywhere in the repo.

7. For failures: return to `copywriter` **once** with the violations. If it fails
   again, leave the lead as it is and surface it for a human. Do not loop.

8. Create Gmail drafts:
   ```bash
   pnpm gmail:drafts
   ```
   Verified-only is enforced in the WHERE clause, so an unverified row is never
   fetched in the first place.

9. Write `run_metrics`: counts at each funnel stage, tokens in/out, duration.

10. Update `memory/STATE.md` and append to `memory/OUTREACH-LOG.md`.

## Report

Six lines, no more:

- how many leads scored, how many cleared 75
- the top three by score, one line each on why
- anything needing action within 48 hours
- verifier failures, if any, and what they were
- token usage versus the 25,000 target

Do not paste email bodies into the report. They are in Gmail.

## Rules

- Steps 3, 5 and 6 are **subagents**. Their bulk context must not enter this thread.
- Never call a model inside a loop.
- Never create a Gmail draft for an unverified row. Filter in SQL.
- If `pnpm tokens` reports over 40,000 it exits non-zero. Treat that as a failing test.
