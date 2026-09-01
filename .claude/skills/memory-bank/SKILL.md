---
name: memory-bank
description: How to read and write the memory/ files correctly — what belongs where, when to read each, and the rotation rules that keep them cheap. Use at the start and end of every build session.
---

# Memory bank

Six files. The value is in reading the *right* one, not all of them.

## What goes where

| File | Contains | Read when | Write when |
|---|---|---|---|
| `PROFILE.md` | Facts about Joshua — the only permitted source for claims | scoring, writing, verifying | only when he says something changed |
| `RUBRIC.md` | Scoring weights and disqualifiers | any scoring task | tuning, with evidence |
| `STATE.md` | What's happening now, next three actions, blockers | **every session start** | **every session end** |
| `DECISIONS.md` | Why choices were made — append-only | about to contradict a past choice | when a choice is made |
| `PATTERNS.md` | Code conventions | before writing new code | when a convention emerges |
| `OUTREACH-LOG.md` | Angles, rules, pre-app manual log | reviewing outreach results | after drafting or sending |

## Reading rules

- **`STATE.md` every session.** It is the context. Start there.
- **Never read `DECISIONS.md` at session start.** It grows forever and is read for
  one purpose: checking whether the thing you're about to do was already decided
  against. Grep it, don't read it.
- **Never read `OUTREACH-LOG.md` whole** once the app is running. That data lives in
  the `outreach` and `events` tables. Query it.
- **Never read all six "for context".** That is the quiet version of wasting tokens.

## Writing rules

### STATE.md — the one that decays

Cap: **150 lines.** It is read every session, so every line is paid for repeatedly.

Structure: Right now · Next three actions · Blocked · Open questions · Recently
done · Reminders that bite.

**Rotation:** when it exceeds 150 lines, summarise the closed items into
`DECISIONS.md` (if they encode a real choice) or delete them (if they were just
work), then truncate. Do this as part of ending the session, not later.

A session that ends without updating STATE costs the next session more than it saved.

### DECISIONS.md — append-only, forever

Never edit an entry. To reverse a decision, add a new one that says
`Supersedes: 003`. The record of having changed your mind is the useful part.

Write an entry when: a choice constrains future work, a plausible alternative was
rejected, or you discover something that invalidates an assumption.

Do **not** write an entry for routine implementation choices. `PATTERNS.md` is for
those.

### PROFILE.md — the highest-stakes file

Changes here change what may be claimed in emails to real people. Change it only
when Joshua confirms the fact, and re-run `verifier` against any pending drafts
afterwards.

Batch profile edits. Each one invalidates the cached prompt prefix for that day.

## Session protocol

**Start**
1. Read `memory/STATE.md`
2. Read only the `docs/` file your task names
3. Grep `DECISIONS.md` only if you're about to make a structural choice

**End** — all four, every time
1. Update `STATE.md`: what moved, what's next, what's blocked
2. Append new conventions to `PATTERNS.md`
3. Rotate `STATE.md` if it's over 150 lines
4. `pnpm typecheck && pnpm test`

`/checkpoint` does all four.

## The failure mode this prevents

Without a memory bank, every session re-derives context from the codebase, re-makes
decisions that were already settled, and re-introduces bugs that were already fixed.
The memory bank is cheaper than that rediscovery — but only while it stays small.
An unbounded memory bank is just a slower version of the same problem.
