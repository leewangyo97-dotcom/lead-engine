---
description: Score, draft and verify today's leads, then create Gmail drafts. The morning routine.
---

Run the morning pipeline. Target: under 25,000 tokens, three model calls, ten minutes.

## Steps

1. Read `memory/STATE.md` and `memory/RUBRIC.md`. Nothing else yet.

2. Query the pre-filtered leads:
   ```sql
   SELECT id, company, title, region, remote_scope, is_contract, is_direct,
          pay_raw, pay_min_usd_hr, stack, summary, trigger_event, overlap_hours
   FROM leads WHERE status = 'needs_scoring'
   ORDER BY (SELECT pre_score FROM scores WHERE lead_id = leads.id) DESC;
   ```
   Expect 15–25 rows. **If more than 40, stop** — the pre-filter has regressed.
   Report it and fix that before spending tokens.

3. Delegate to the `scorer` subagent. **One batched call** with all rows. Persist
   `modelScore`, `tier`, `reason`, `rubricVersion`.

4. Promote: `score >= 75` → `status = 'needs_draft'`. Everything else → `'parked'`.

5. Delegate to the `copywriter` subagent. One batched call over the survivors.
   Persist to `outreach` with `angle` and `proofUsed` populated — a draft missing
   either teaches the learning loop nothing.

6. Delegate to the `verifier` subagent. One call. Set `verifiedAt` on passes.

7. For failures: return to `copywriter` **once** with the violations. If it fails
   again, leave `status = 'needs_draft'` and surface it for a human. Do not loop.

8. Create Gmail drafts — only for rows where `verifiedAt IS NOT NULL`. Store
   `gmailDraftId`. Log a `draft_created` event per lead.

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
- If `pnpm tokens` reports over 40,000, treat it as a failing test.
