---
name: token-discipline
description: Read before any task that touches many rows, reads many files, or calls a model. The rules that keep this project's token cost ~98% below naive. Use when scoring, harvesting, drafting, or reviewing many leads.
---

# Token discipline

One idea: **the model only ever sees what requires judgment.** Everything else is
TypeScript.

Full reasoning and the numbers: `docs/05-TOKEN-BUDGET.md`. This is the checklist.

## Before any model call, ask

1. **Could code do this?** Parsing, filtering, deduping, sorting, counting,
   formatting — all code. If you are about to ask a model to extract a field from
   JSON, stop and write a line of TypeScript.
2. **Am I sending raw source data?** Raw HTML or raw API JSON must never reach a
   prompt. Normalise first. A `NormalisedLead` is ~120 tokens; the raw record is
   2,000–5,000.
3. **Am I about to loop?** `for (x of xs) await model(x)` is the most expensive
   mistake available. Batch into one call.
4. **Is the stable content first?** Rubric, profile and schema at the top;
   tonight's variable data last. Cache hits depend on the prefix being identical.
5. **Have I projected the fields?** Send `{company, title, region, contract, stack,
   pay}`. Not the description. Not the raw URL payload. Not fields "just in case".
6. **Is the output capped?** `max_tokens` set, Zod schema supplied, reason fields
   character-limited. Prose in a scoring response is pure waste.

## The filter is the budget

Cost scales with **how many rows survive pre-filtering**, and almost nothing else.
Target 15–25 rows reaching stage 2 per night from ~400 raw.

If stage 2 is seeing 60 rows, do not optimise the prompt. Fix the filter.

## Reading files

- `CLAUDE.md` — every session. Keep it under 200 lines.
- `memory/STATE.md` — every session. Capped at 150 lines.
- `memory/DECISIONS.md` — only when about to contradict a past choice.
- `memory/OUTREACH-LOG.md` — never whole. Query the `outreach` table.
- `docs/*` — only when the current task names the file.

Reading a file "for context" that the task does not need is the quiet version of
the same waste.

## Subagents are context isolation

Delegate anything that must read bulk data. `harvester` reads HTML; `verifier`
reads full drafts. Both run in their own context and return three lines. The main
thread stays small, which is what makes long sessions viable at all.

## Measure

`pnpm tokens` reports the funnel and token usage for recent runs.

Nothing measures the tokens for you. Model calls happen inside Claude Code, so
the counts come from the session that made them — `/daily-run` ends with:

```bash
pnpm tokens:record --in <input> --out <output> --scored <n> --drafted <n>
```

Skip it and `pnpm tokens` prints "(not measured)" and the budget below is
unenforceable.

The funnel columns read `raw` (items fetched), `new` (survived the content hash)
and `survived` (through the hard filters). A large gap between raw and new is the
hash working, which is the saving the whole design rests on.

- Under 25,000 per night: healthy
- 25,000–40,000: investigate the filter
- Over 40,000: **a failing test.** Something regressed. Find it before shipping.
