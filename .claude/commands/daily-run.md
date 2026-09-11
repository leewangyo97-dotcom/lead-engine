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

   `pnpm followups` emits **leads only**, and says on stderr how many prospect
   follow-ups it left out. That is not data loss: prospect follow-ups are written
   by the app from the trade and the step when the button is clicked, so there is
   nothing here for a model to do with them. Expect the payload count to be far
   smaller than the number on `/followups`.

5. Delegate to the `copywriter` subagent. One batched call. Persist with:
   ```bash
   cat drafts.json | pnpm apply:drafts
   ```
   `angle` and `proofUsed` are required by the schema — a draft missing either
   teaches the learning loop nothing, so it is rejected rather than stored.

   **A follow-up must carry `"step": 1` or `"step": 2`.** Omitting it means a
   first touch, and a nudge stored as step 0 becomes a second opening email: the
   outreach log shows two first contacts with one company, and the ladder reads
   the highest step as 0 forever, so it keeps asking for a follow-up that was
   already written. `apply:drafts` checks the rung against what has actually been
   sent and refuses anything out of order — a skipped rung, a duplicate of an
   unsent one, or a fourth touch.

   Take the step from the `nextStep` field that `pnpm followups` gives you for
   each lead. Its `previousSubject` and `previousAngle` are there so the nudge
   does not repeat the angle that already failed to land.

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

9. Record what the run cost, against the harvest's own metrics row:
   ```bash
   pnpm tokens:record --in <input> --out <output> --scored <n> --drafted <n>
   ```
   Take the numbers from this session. Without them `pnpm tokens` reports
   "(not measured)" and the 25,000 target cannot be checked.

   Two things that have already gone wrong here. The counts attach to the **most
   recent harvest run**, so record them before the next night's harvest or they
   land on the wrong row. And the figures are refused if the run's own funnel
   cannot support them — `--scored 18` against a night where two leads survived
   the pre-filter is rejected, because a metrics table holding a number that
   could not have happened is worse than one holding nothing.

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
