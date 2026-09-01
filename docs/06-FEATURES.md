# Features — what makes this better than a spreadsheet

Nine features. Each is genuinely differentiated, and each is invisible-by-default:
the user does nothing to get the benefit. That combination is the bar. A feature
that requires configuration to be valuable has failed it.

Ranked by how much they matter.

---

## 1. The reply-learning loop  ★ the actual moat

Every draft records its `angle`, `proofUsed`, source, stack and send day. Every
outcome is logged. After ~30 sends, the weekly review can say things no generic
advice can:

> "Emails leading with the crash-rate number got 4 replies in 11 sends.
> Emails leading with years of experience got 0 in 9."

The system then proposes a rubric change. **It never applies one automatically** —
Joshua accepts or dismisses, and accepting writes to `memory/DECISIONS.md`.

This is the only feature here that compounds. In three months the tool is tuned to
what works for *him*, not to what a blog post said works.

---

## 2. "Why now" trigger detection

Timing beats copy. Every lead carries the event that makes contacting them timely:
*raised a seed 6 days ago · posted this role today · migrating to Kotlin
Multiplatform · lost their mobile lead last month*.

The copywriter must open with the trigger, never with "I am a developer with 7
years of experience". A lead with no detectable trigger scores lower, because
without one there is no reason for the email to arrive today rather than never.

---

## 3. Timezone honesty, computed

Every lead shows **actual overlap hours** with a 09:00–18:00 Manila day, derived
from the stated region — not guessed, not "remote-friendly ✓".

`Remote US · 2h overlap` tells Joshua more in four words than a paragraph of
company blurb. It is also the highest-weighted scoring input, because it is the
variable that most often decides whether the work is winnable at all.

---

## 4. Proof-match

Joshua has three hard numbers: crash rate −35%, 3,000+ defects cleared, 30 signed
release variants in ~5 minutes. Plus named shipped apps.

A lookup table maps lead signals to the proof that lands:

| Lead signal | Lead with |
|---|---|
| React Native / mobile | crash rate −35% + named consumer apps |
| DevOps / CI / release | 30 variants in ~5 min via Fastlane |
| "legacy", "rescue", "inherit" | 3,000+ defects resolved |
| real-time / chat / video | Tencent IM 3.x→4.x migration |
| consumer scale | Jollibee · Landbank · JoyRide |
| agents / LLM tooling | custom Claude Code agents, skills, MCP servers |

Same person, different opening line, materially different reply rate.

---

## 5. The follow-up ladder

On send, day-4 and day-11 follow-up drafts are queued automatically. Each references
the original rather than repeating it. If a reply arrives, the ladder cancels itself.

Most replies come from the second touch. Almost nobody sends it. This is the
highest ratio of value to effort in the entire project.

---

## 6. Claim verification  ★ the safety feature

Before any draft reaches Gmail, `verifier` checks every factual claim against
`memory/PROFILE.md` and marks anything unsupported. Unverified drafts cannot be
created — enforced in the query, not by convention.

The failure mode this prevents is career-damaging: a plausible-sounding invented
metric in an email to someone who later interviews you. Worth a whole agent.

---

## 7. Rate calibration

The system already reads every posted rate. So it can tell Joshua the live market
median for his stack and region — *"12 APAC-eligible contract roles this month
posted a median of $58/hr; you are asking $40"* — and flag every lead paying above
his ask.

Evidence beats exhortation. He'll raise his rate when he sees the distribution.

---

## 8. Company memory

Never pitch the same company twice within 90 days, and when re-approaching, open
with what was said last time. A lead whose company appears in `outreach` history
surfaces that history in the detail view.

Prevents the specific embarrassment of two near-identical emails to one founder.

---

## 9. Source autopsy

Monthly: replies per source, per 100 leads. Sources producing zero replies over 60
days get auto-flagged for disabling. Keeps the funnel from silently filling with a
board that stopped being useful.

---

## Deliberately rejected

- **Auto-send** — the thing that makes this work is that a human sends. Automating
  it converts a good tool into spam infrastructure.
- **LinkedIn / Upwork scraping** — against their terms, and it risks the real
  accounts Joshua needs. Public sources only.
- **AI-generated personalisation at scale** — the moment every email is generated,
  they read generated. Twelve good emails beat five hundred.
- **A Chrome extension** — a second surface to maintain for no added reach.
- **Lead scoring by an ML model** — a rules table Joshua can read, argue with, and
  edit beats an opaque model at this volume. Interpretability is the feature.
