---
description: End-of-session hygiene — update memory, rotate STATE, run the gate.
---

Close out this session properly. Four steps, all of them, every time.

## 1. Update `memory/STATE.md`

Rewrite these sections to reflect reality right now:

- **Right now** — one paragraph, what phase and what's in flight
- **Next three actions** — concrete and executable by someone with no context
- **Blocked** — what's stuck and on whom
- **Recently done** — dated, one line each

Be specific. "Continue Phase 2" is useless to the next session. "Write
`lib/scoring/disqualify.ts` — the eight rules are in RUBRIC.md, tests go in
`disqualify.test.ts`" is not.

## 2. Append to `memory/PATTERNS.md`

Only if a genuinely new convention emerged. Not for routine choices.

## 3. Rotate if needed

If `memory/STATE.md` exceeds **150 lines**:
- Items encoding a real choice → summarise into `memory/DECISIONS.md` as a new
  numbered entry
- Items that were just work → delete
- Truncate STATE back under 150

If a decision was made this session that constrains future work, write it into
`DECISIONS.md` now — append-only, never edit an existing entry.

## 4. Run the gate

```bash
pnpm typecheck && pnpm test
```

If either fails, say so plainly in the summary. Do not fix it silently and do not
leave it undocumented — the next session needs to know it's walking into a red build.

## Report

Four lines: what moved, what's next, what's blocked, gate status.
