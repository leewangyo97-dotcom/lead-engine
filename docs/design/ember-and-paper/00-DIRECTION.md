# 00 — Direction

**System name:** Ember & Paper
**Product:** Lead Engine — a tool one person opens every weekday morning
**Direction:** Warm editorial. Ink on paper, not pixels on a screen.

---

## The thesis

This is a tool someone uses at 8am, half-awake, to make a handful of decisions
quickly. It should feel like a well-made notebook: quiet, warm, confident, with a
hand visible in it. Not a dashboard. Not a SaaS marketing page.

Everything below serves one goal — **it should look made, not generated.**

---

## Why most AI-assisted design looks robotic

Name the failure precisely, or you'll reproduce it. The tells are mechanical, and
each one has a specific fix.

| The tell | Why it reads robotic | What we do instead |
|---|---|---|
| One radius on everything (`rounded-lg`) | Nothing was decided; a default was accepted | Radius by role — 6 values, each justified |
| Even spacing everywhere | No rhythm, so no hierarchy | Asymmetric scale; space above a heading ≠ below |
| Stock icon set, untouched | Same icons as ten thousand other apps | 40 icons drawn to our grid, with deliberate quirks |
| Inter / Space Grotesk | The safe default, so it says nothing | Fraunces + Instrument Sans |
| Pure `#000` and `#FFF` | No physical surface is either | Warm near-black, warm off-white |
| Neutral grey `#888` | Unmixed, uninhabited | Greys biased toward the accent hue |
| Everything centred | Centring is what you do when you haven't decided | Left-aligned by default; centre only for genuinely symmetric content |
| Cards with an accent bar | A 2021 template | Hairline rules and generous margin |
| Five shadow elevations | Simulated depth nobody asked for | One rule, one soft shadow, one overlay |
| Emoji as section markers | Decoration standing in for hierarchy | Type weight and space do the work |
| Gradient hero | Filler where a thesis belongs | No gradients anywhere in this system |
| A flourish in every block | Noise | One flourish per screen, maximum |

---

## The seven mechanisms that make it human

These are the things to actually build. They are small, and they are the difference.

### 1. Wonk

Fraunces carries two axes most typefaces don't: `SOFT` (0–100) and `WONK` (0–1).
WONK swaps in genuinely eccentric letterforms — a curled *g*, an angled *y* terminal.

- **Display type: `WONK=1`, `SOFT=40`.** This is the single highest-leverage
  decision in the system. It is the hand in the work.
- **Headings: `WONK=0`, `SOFT=25`.** Quieter, still warm.
- Never set WONK on anything under 20px — it becomes noise at small sizes.

### 2. Optical correction, not mathematical centring

Machines centre by bounding box. People centre by eye.

- A triangular play/send glyph sits **+1px right** of true centre
- Icons beside text align to the text's **x-height**, not its bounding box
- Quotation marks and bullets **hang** into the left margin
- Uppercase labels get `+0.08em` tracking; lowercase body gets `0`
- Large display type gets `-0.02em`; small text gets `+0.01em`

### 3. Asymmetric vertical rhythm

Even spacing reads as a wireframe. Editorial spacing has a pulse.

**Rule: the space above a heading is ~1.6× the space below it.** A heading belongs
to the text under it, and the gap should say so.

### 4. Radius by role

Six values, each with a reason. Never one global radius.

Small controls are crisper; large containers are softer. That difference is what a
person notices without being able to name it.

### 5. Warm, mixed neutrals

Every grey is biased toward the ember accent. Nothing is `#808080`. The near-black
is `#1B1A16`, not `#111111` — it has warmth in it, the way real ink does.

### 6. Rules, not boxes

Hairline horizontal rules separate content. Boxes-inside-boxes-inside-cards is
software chrome; rules are typography. Where a container is genuinely needed, it
gets one hairline border and real internal margin — not a shadow and a tint.

### 7. Real words

Every component ships with real content, never lorem, never "Card Title". The
microcopy is written by a person with an opinion — see `07-CONTENT.md`. A perfect
layout full of placeholder text still reads as generated.

---

## Principles for judgement calls

1. **Legibility over cleverness.** Every flourish is a debt against a tired user.
2. **One voice per screen.** One display moment, one accent use, everything else quiet.
3. **The grid is a servant.** Break it deliberately when the content asks; never by accident.
4. **Density is respect.** This user scans a list every morning — don't make him scroll for whitespace's sake.
5. **Both themes are designed, not inverted.** Dark mode gets its own considered values.
6. **Accessible by construction.** 4.5:1 for body, 3:1 for large text and UI edges, in both themes. Non-negotiable, and checked in `01-FOUNDATIONS.md`.
7. **If it could belong to any other product, cut it.**

---

## Continuity

This evolves the existing Lead Engine dashboards rather than replacing them. Ember
`#C2451F` and Fraunces carry over. The ground warms from cool slate-green to a
warm greige, and the body face moves from Archivo to Instrument Sans — which is
described by its own designers as balancing precision with *"subtle notes of
playfulness"*, which is the brief exactly.
