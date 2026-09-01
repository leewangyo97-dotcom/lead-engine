---
name: lead-scoring
description: How to score a lead against Joshua's profile — the two-stage design, the weights, the disqualifiers. Use when scoring leads, tuning the rubric, or debugging a score that looks wrong.
---

# Lead scoring

## Two stages, and the split matters

**Stage 1 — deterministic TypeScript, free.** Region eligibility, contract flag,
stack keyword weights, direct-inbox detection, pay band, freshness. Produces
`preScore` (0–100). Runs on every harvested lead, nightly, in GitHub Actions.

**Stage 2 — model, ±15 adjustment only.** Runs on 15–25 survivors. Applies the
listed adjustments and writes a 120-character reason.

The split is not an optimisation, it is the architecture. Stage 1 is inspectable,
testable and free; stage 2 is judgment on a small number of rows. If stage 2 is
seeing 60 rows a night, stage 1 is broken — fix the filter, not the prompt.

## Weights

Authoritative source is `memory/RUBRIC.md`. Summary:

| Dimension | Max | Note |
|---|---|---|
| Timezone eligibility | 30 | **highest weight, deliberately** |
| Stack match | 25 | mobile scores highest — that is his edge |
| Contract terms | 20 | |
| Direct contact | 10 | personal inbox ≫ ATS form |
| Pay signal | 10 | |
| Trigger freshness | 5 | |

### Why timezone outranks stack

A perfect stack match at a company that legally cannot hire someone in the
Philippines is worth zero. Most "remote" roles are quietly region-locked, and that
is the variable that decides whether the work is winnable at all. Everything else
is a tiebreak among the leads that clear it.

## Hard disqualifiers — code, before any model call

Reject outright: disqualified stacks (embedded C/C++, Rust systems, Go-primary, ML
research, Solidity, formal verification, HPC/GPU); onsite-with-no-remote-and-no-
contract; a required language he doesn't speak; citizenship or clearance
requirements; non-engineering roles; postings older than 45 days; companies
contacted within 90 days; unpaid or equity-only.

These are regex and a `WHERE` clause. They cost nothing and they remove the
majority of a night's rows.

## Tiers

`live` ≥75 · `warn` 60–74 · `cold` <60. Draft threshold: **75**.

## Debugging a wrong score

1. Look at `scores.preScore` versus `scores.modelScore`. The gap is `delta`.
2. If `preScore` is wrong, the bug is in `lib/scoring/prescore.ts` — a keyword miss
   or a region parsed incorrectly. Add a table-driven test for that case.
3. If `delta` is wrong, the model applied an adjustment not in the rubric. Tighten
   the agent prompt; do not widen the ±15 cap.
4. If the lead should never have been scored at all, a hard disqualifier missed.
   That is the most expensive class of bug here — every leak costs tokens nightly.

## Tuning

Never on a hunch. From Phase 6, the weekly review proposes changes from measured
reply rates. Every change:

1. Edit `memory/RUBRIC.md`
2. Bump the version (semver: patch = weight nudge, minor = new dimension)
3. Log the evidence in `memory/DECISIONS.md`

`scores.rubricVersion` records which version produced each score, so historical
comparisons stay honest across changes.
