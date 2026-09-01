# RUBRIC — scoring weights

**Version: 1.1.0** — bump on every change; `scores.rubricVersion` records it.

Score is 0–100. Stage 1 (deterministic TypeScript) computes everything it can.
Stage 2 (model) adjusts within ±15 and writes the reason.

## Weights

| Dimension | Max | How |
|---|---|---|
| **Timezone eligibility** | 30 | worldwide/global 30 · APAC or Asia-HQ 30 · EMEA 22 · "remote" unqualified 15 · US-only 6 · onsite 0 |
| **Contract terms** | 20 | explicit contract/freelance/1099/B2B 20 · "open to contract" 12 · full-time only 5 |
| **Stack match** | 25 | see table below |
| **Direct contact** | 10 | personal inbox 10 · role inbox 6 · ATS form 2 |
| **Pay signal** | 10 | ≥$60/hr equiv 10 · $45–59 7 · stated but lower 3 · unstated 4 |
| **Trigger freshness** | 5 | ≤7 days 5 · ≤21 days 3 · older 0 |

### Stack sub-weights (max 25, take the highest match)

| Signal | Points |
|---|---|
| Kotlin, Android, Jetpack Compose, KMP/CMP | 25 |
| React Native, Flutter, cross-platform mobile | 23 |
| TypeScript + React/Next.js full-stack | 19 |
| Node.js / Express backend | 16 |
| Python / Django / FastAPI | 13 |
| Vue / Nuxt / PHP / Laravel | 11 |
| Agent tooling, MCP, AI-assisted dev workflows | 15 |
| CI/CD, Fastlane, release engineering | 14 |

## Founder leads — `kind = 'funding'`

A Launch HN post is not a job posting. It states no region, no contract terms and
no pay, so the table above would score it near zero for things the founder has
not been asked yet. Scoring it on absent fields would be measuring our ignorance.

These four dimensions are what such a post actually contains:

| Dimension | Max | How |
|---|---|---|
| **Trigger freshness** | 30 | ≤7 days 30 · ≤21 days 18 · ≤45 days 6 · older 0 |
| **Stack match** | 30 | same sub-weights as above, scaled to 30 |
| **Direct contact** | 25 | founder's own inbox 25 · role inbox 10 · none 4 |
| **Stage signal** | 15 | named accelerator batch 15 · launch post alone 8 |

Timezone and contract terms are deliberately absent. They are the two things a
first email exists to find out, and a founder who has just launched has usually
not decided either.

The `needs_draft` threshold stays 75 for both kinds.

## Tiers

- **live** ≥ 75 — act today
- **warn** 60–74 — worth an email this week
- **cold** < 60 — long shot, one short email at most

`needs_draft` threshold: **75**.

## Hard disqualifiers — code, before any model sees the row

Reject outright:

1. Stack is in the PROFILE disqualified list (embedded C/C++, Rust systems, Go-only,
   ML research, Solidity, formal verification, HPC/GPU)
2. Requires on-site attendance with no remote option **and** no contract option
3. Requires a language Joshua doesn't speak (German, Japanese, Korean, French)
4. Requires citizenship or a security clearance
5. Non-engineering role (sales, marketing, ops, design, recruiting)
6. Posted more than 45 days ago
7. Company contacted within the last 90 days
8. Unpaid, equity-only, or "revenue share"

## Stage-2 adjustments (model, ±15 total)

Only these. Do not invent new dimensions.

- **+8** the posting explicitly welcomes non-US or Asia-based contractors
- **+6** the trigger is strong and specific (funded <14 days, mobile lead departed,
  a migration Joshua has done before)
- **+5** an unusually precise stack match — Kotlin **and** Next.js, or KMP named
- **−8** region wording implies a hard legal restriction not caught by the filter
- **−6** the posting reads like an agency reselling, not the end client
- **−10** seniority is clearly below or far above (intern; VP Engineering)

## Tuning log

Append every change here with evidence. Never tune on a hunch.

| Date | Change | Why | Version |
|---|---|---|---|
| 2026-09-01 | Initial | Derived from resume + first manual lead pass | 1.0.0 |
| 2026-09-01 | Added `kind='funding'` weights | The source survey found free job boards carry almost no contract work with a named contact — 30 of the 100 points above describe what those feeds structurally lack. Founder leads are a different shape and needed their own dimensions. **These weights are initial and unvalidated**, in the same sense 1.0.0 was: no outcome data exists for founder outreach yet. The Phase 6 loop should be the thing that corrects them. | 1.1.0 |

> Phase 6 note: once 30+ outcomes are logged, the weekly review proposes changes
> here from measured reply rates. Proposals are never auto-applied.
