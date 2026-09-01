# 01 — Foundations

Every token here becomes a Figma variable. Build these **before any component** —
a component built on raw hex has to be rebuilt.

---

## Colour

### Primitives — collection `primitive/colour`

Raw values. Never referenced directly by a component; semantic tokens alias these.

```
paper/50    #FBFAF6      ink/900   #1B1A16      ember/700  #93300F
paper/100   #F5F3EC      ink/800   #2C2A24      ember/600  #A93A17
paper/200   #F2F1EA      ink/700   #3F3D37      ember/500  #C2451F   ← accent
paper/300   #EAE8DF      ink/600   #56534A      ember/400  #D4633F
paper/400   #DDD9CE      ink/500   #5A574F      ember/300  #E58C6C
paper/500   #C7C2B3      ink/400   #6E6B60      ember/200  #F0BCA7
                         ink/300   #B3AFA2      ember/100  #F7E4DA

night/900   #100F0C      go/600   #245741       hold/600  #7A5410
night/800   #14130F      go/500   #2F6B4F       hold/500  #855C0F
night/700   #1D1B16      go/400   #4E9271       hold/400  #C08D2A
night/600   #262319      go/300   #6FBF93       hold/300  #D6A445
night/500   #2E2B23      go/100   #DFEBE2       hold/100  #F5E8CE

stop/600  #6E2430    stop/500  #8A2E3B    stop/300  #D4707C    stop/100  #F3DDE1
```

**Why `stop` is wine, not red:** the accent is already an orange-red. A red error
state next to an ember button muddies both. Wine `#8A2E3B` is cooler and darker —
distinguishable at a glance, which is the entire job of an error colour.

### Semantic — collection `semantic/colour`, modes **Light** and **Dark**

Components reference **only** these.

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg/canvas` | `paper/200` | `night/800` | page ground |
| `bg/surface` | `paper/50` | `night/700` | cards, panels |
| `bg/sunk` | `paper/300` | `night/900` | inset wells, code |
| `bg/hover` | `paper/300` | `night/600` | row hover |
| `bg/selected` | `ember/100` | `ember/700` @ 22% | active row |
| `text/primary` | `ink/900` | `paper/100` | body, headings |
| `text/secondary` | `ink/700` | `paper/500` | supporting |
| `text/muted` | `ink/500` | `ink/300` | metadata, captions |
| `text/faint` | `ink/400` | `ink/500` | placeholders |
| `text/onAccent` | `paper/50` | `night/900` | text on ember fill |
| `rule/default` | `paper/400` | `night/500` | hairline dividers |
| `rule/soft` | `paper/300` | `night/600` | internal separators |
| `rule/strong` | `ink/300` | `ink/600` | input borders |
| `accent/base` | `ember/500` | `ember/400` | links, active, primary fill |
| `accent/hover` | `ember/600` | `ember/300` | |
| `accent/tint` | `ember/100` | `ember/700` @ 30% | selected backgrounds |
| `status/go` | `go/500` | `go/300` | eligible, verified, success |
| `status/go-tint` | `go/100` | `go/600` @ 30% | |
| `status/hold` | `hold/500` | `hold/300` | warning, pending |
| `status/hold-tint` | `hold/100` | `hold/600` @ 30% | |
| `status/stop` | `stop/500` | `stop/300` | error, destructive |
| `status/stop-tint` | `stop/100` | `stop/600` @ 30% | |

### Contrast — computed, not estimated

Every pair below was calculated with the WCAG 2.1 relative-luminance formula.
**Every one passes AA (4.5:1) for body text**, in both themes.

| Pair | Ratio | Passes |
|---|---|---|
| `ink/900` on `paper/200` | 15.38:1 | AAA |
| `ink/700` on `paper/200` | 9.59:1 | AAA |
| `ink/500` on `paper/200` | 6.37:1 | AA |
| `ink/400` on `paper/200` | 4.71:1 | AA |
| `paper/50` on `ember/500` | 4.83:1 | AA |
| `go/500` on `paper/200` | 5.56:1 | AA |
| `hold/500` on `paper/200` | 5.25:1 | AA |
| `stop/500` on `paper/200` | 7.32:1 | AAA |
| `paper/100` on `night/800` | 16.74:1 | AAA |
| `ink/300` on `night/800` | 8.47:1 | AAA |
| `ember/400` on `night/800` | 5.01:1 | AA |
| `go/300` on `night/800` | 8.45:1 | AAA |
| `hold/300` on `night/800` | 8.19:1 | AAA |
| `stop/300` on `night/800` | 5.67:1 | AA |

> Two values were corrected during this check. `ink/400` started at `#949185`,
> which measured **2.79:1** — failing even the 3:1 threshold for UI edges, let alone
> placeholder text. `hold/500` started at `#9A6B12` and measured 4.13:1, just under
> AA. Both were darkened until they passed. Warm greys look darker than they
> measure, which is exactly why this gets computed rather than eyeballed.

**Rule:** `text/faint` is for placeholders and disabled states. It now clears AA,
so it is *safe* as text — but it still shouldn't carry meaning, because low
contrast reads as inactive whether or not it passes.

**If you change any colour, recompute.** Do not adjust a ratio in this table to
match a colour you liked.

---

## Typography

### Families

| Role | Family | Source | Fallback |
|---|---|---|---|
| Display | **Fraunces** | Google Fonts | `Georgia, 'Times New Roman', serif` |
| UI / body | **Instrument Sans** | Google Fonts | `'Helvetica Neue', Arial, sans-serif` |
| Data / mono | **JetBrains Mono** | Google Fonts | `ui-monospace, Menlo, monospace` |

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,300..900,0..100,0..1&family=Instrument+Sans:wght@400..700&family=JetBrains+Mono:wght@400..700&display=swap">
```

### Fraunces axes — the character control

| Axis | Range | Our use |
|---|---|---|
| `opsz` | 9–144 | **Always match the render size.** 48px text → `opsz 48`. This is what optical sizing is for |
| `wght` | 300–900 | 600 headings, 700 display |
| `SOFT` | 0–100 | softens terminals — warmth |
| `WONK` | 0–1 | swaps in eccentric alternates — **the hand in the work** |

- Display (32px+): `WONK 1`, `SOFT 40`
- Headings (20–31px): `WONK 0`, `SOFT 25`
- **Never `WONK 1` below 20px.** It stops reading as character and starts reading as a rendering error.

### Scale

Not linear. The jumps are deliberate — a real hierarchy has gaps in it.

| Token | Size / line-height | Family | Weight | Tracking | Axes |
|---|---|---|---|---|---|
| `display/xl` | 44 / 1.02 | Fraunces | 700 | −0.022em | opsz 44, SOFT 40, WONK 1 |
| `display/lg` | 32 / 1.08 | Fraunces | 700 | −0.018em | opsz 32, SOFT 40, WONK 1 |
| `heading/lg` | 24 / 1.22 | Fraunces | 600 | −0.012em | opsz 24, SOFT 25, WONK 0 |
| `heading/md` | 19 / 1.3 | Fraunces | 600 | −0.008em | opsz 19, SOFT 25, WONK 0 |
| `subhead` | 16 / 1.4 | Instrument Sans | 600 | 0 | — |
| `body/lg` | 16 / 1.62 | Instrument Sans | 400 | 0 | — |
| `body` | 14.5 / 1.6 | Instrument Sans | 400 | 0 | — |
| `body/sm` | 13 / 1.55 | Instrument Sans | 400 | +0.004em | — |
| `label` | 11 / 1.25 | Instrument Sans | 600 | **+0.09em**, uppercase | — |
| `data/lg` | 22 / 1.1 | JetBrains Mono | 700 | −0.01em | tabular-nums |
| `data` | 13.5 / 1.3 | JetBrains Mono | 500 | 0 | tabular-nums |
| `data/sm` | 11.5 / 1.3 | JetBrains Mono | 400 | +0.01em | tabular-nums |
| `caption` | 12 / 1.45 | Instrument Sans | 400 | +0.006em | — |

### Rules

- **Measure: 62–70 characters** for running text. Wider is a wall; narrower is a column of scraps.
- **`text-wrap: balance` on every heading.** A two-word orphan on line two undoes the whole page.
- **`font-variant-numeric: tabular-nums` on every column of digits** — scores, rates, dates, counts.
- Never more than three type roles visible in one view.
- Line-height falls as size rises. Never one value across the scale.

---

## Spacing

Base unit 4. The scale is not a doubling sequence — real layouts need the awkward
middle values.

```
space/0    0      space/5   16     space/9    40
space/1    2      space/6   20     space/10   56
space/2    4      space/7   24     space/11   72
space/3    8      space/8   32     space/12   96
space/4    12
```

### The rhythm rule

**Space above a heading ≈ 1.6× the space below it.**

| Context | Above | Below |
|---|---|---|
| Section heading | `space/9` (40) | `space/5` (16) |
| Subsection heading | `space/7` (24) | `space/4` (12) |
| Inline heading | `space/5` (16) | `space/3` (8) |

This one asymmetry does more for perceived craft than any amount of colour work.
A heading floating equidistant between two paragraphs belongs to neither.

### Component padding

| Component | Padding |
|---|---|
| Button sm / md / lg | `6 12` / `9 16` / `12 22` |
| Input | `10 12` |
| Card | `20 24` |
| Row (list item) | `13 18` |
| Modal | `28 32` |
| Chip | `3 8` |

---

## Radius — by role, never global

```
radius/xs    3px    chips, pills, badges, tags
radius/sm    5px    buttons, inputs, selects
radius/md    8px    cards, panels, popovers
radius/lg   12px    modals, sheets, drawers
radius/xl   20px    hero surfaces, illustration frames
radius/full 999px   avatars, status dots, toggles
```

**Never apply one radius everywhere.** The graduation from crisp small controls to
softer large containers is a real signal that decisions were made.

---

## Elevation

Three levels. Not five. Depth is mostly the job of hairline rules.

| Token | Light | Dark |
|---|---|---|
| `elev/flat` | none + `1px solid rule/default` | same |
| `elev/raised` | `0 1px 2px rgba(27,26,22,.05)`, `0 8px 24px -16px rgba(27,26,22,.20)` | `0 1px 2px rgba(0,0,0,.35)`, `0 8px 24px -16px rgba(0,0,0,.7)` |
| `elev/overlay` | `0 2px 6px rgba(27,26,22,.07)`, `0 28px 56px -28px rgba(27,26,22,.30)` | `0 2px 6px rgba(0,0,0,.45)`, `0 28px 56px -28px rgba(0,0,0,.8)` |

Shadows are warm-tinted (from `ink/900`), never pure black. A neutral shadow on a
warm ground reads as dirt.

---

## Grid

| Breakpoint | Width | Columns | Gutter | Margin |
|---|---|---|---|---|
| `xs` | 360–599 | 4 | 16 | 20 |
| `sm` | 600–899 | 8 | 20 | 24 |
| `md` | 900–1199 | 12 | 24 | 32 |
| `lg` | 1200–1439 | 12 | 24 | 40 |
| `xl` | 1440+ | 12 | 32 | auto (max 1240) |

Content max-width **1240**. Reading columns cap at **68ch** regardless of container.

---

## Focus

One treatment everywhere, and it must be visible on both themes:

```
outline: 2px solid accent/base;
outline-offset: 2px;
border-radius: inherit;
```

Never remove focus rings. Never replace them with a colour change alone.
