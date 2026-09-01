# 07 — Figma build order

Build in this sequence. It is not a suggestion: a component built before its
variables exist has hardcoded values, and hardcoded values have to be rebuilt by
hand across every variant.

**Rule for the whole build: nothing is hardcoded.** Every fill, stroke, corner
radius, gap and padding binds to a variable. If you're typing a hex into a
component, a step was skipped.

---

## File & page structure

```
📄 Ember & Paper — Design System
   ├── 🎨 Foundations      colour ramps, type specimen, spacing, radius, elevation
   ├── ✦ Icons             40 components, 24×24
   ├── ⬡ Components        component sets, grouped
   ├── ▦ Patterns          composed blocks
   └── ▢ Screens           full layouts, lg + xs

📄 Ember & Paper — Product
   └── screens that consume the library
```

---

## Step 1 — Variable collections

Four collections. Create them before anything else.

### `primitive/colour` — one mode

Every ramp from `01-FOUNDATIONS.md`: `paper/50–500`, `ink/300–900`,
`night/500–900`, `ember/100–700`, `go/100–600`, `hold/100–600`, `stop/100–600`.

Raw values only. Nothing outside `semantic/colour` ever references these.

### `semantic/colour` — **two modes: Light, Dark**

Every token from the semantic table. **Each is an alias to a primitive**, never a
raw hex. This is what makes theming work: switch the mode, and every component
follows, because nothing below this layer knows what colour it is.

Where the table says a percentage (e.g. `ember/700 @ 22%`), create the composite as
its own primitive first and alias to that — Figma variables can't express opacity
on an alias.

### `scale` — one mode

```
space/0…12       0 2 4 8 12 16 20 24 32 40 56 72 96
radius/xs…full   3 5 8 12 20 999
icon/sm…xl       16 20 24 40
```

### `type` — one mode

Numeric tokens only (`size/*`, `lineHeight/*`, `tracking/*`). The families and
axis settings live in text styles, next step.

---

## Step 2 — Text styles

Fourteen styles, exactly as tabled in `01-FOUNDATIONS.md`.

Name them `display/xl`, `display/lg`, `heading/lg`, `heading/md`, `subhead`,
`body/lg`, `body`, `body/sm`, `label`, `data/lg`, `data`, `data/sm`, `caption`.

**For every Fraunces style, set all four axes explicitly:**

| Style | opsz | wght | SOFT | WONK |
|---|---|---|---|---|
| `display/xl` | 44 | 700 | 40 | **1** |
| `display/lg` | 32 | 700 | 40 | **1** |
| `heading/lg` | 24 | 600 | 25 | 0 |
| `heading/md` | 19 | 600 | 25 | 0 |

`opsz` must equal the render size. That is the entire purpose of an optical size
axis, and leaving it at default throws away the best thing about this typeface.

On every `data/*` style enable **tabular figures** in the OpenType panel.

---

## Step 3 — Effect & grid styles

- `elev/raised`, `elev/overlay` — two-layer shadows, warm-tinted from `ink/900`
- Layout grids per breakpoint from `04-RESPONSIVE.md`, saved as grid styles named
  `grid/xs` … `grid/xl`

---

## Step 4 — Icons

Forty components on the Icons page. Read `02-ICONS.md` first — the construction
rules and the deliberate quirks are the point of the set.

- 24×24 frame, 20×20 live area
- Strokes drawn at 1.5px, **expanded to outlines** before componentising
- Single vector layer per icon, fill bound to a colour variable so it themes
- Draw **three masters** — 16, 20, 24. Do not scale one master
- Build `clock-overlap` first. It's the signature icon and it'll set the hand for
  the rest of the set

---

## Step 5 — Base components

In this order. Each depends on the ones above it.

1. `Icon` wrapper (size variant, colour bound)
2. `Divider`
3. `Chip` → `Badge`
4. `Button` → `IconButton`
5. `Input` → `Textarea` → `Select`
6. `Checkbox` → `Radio` → `Switch`
7. `Avatar`
8. `Tooltip`

Every one gets the full six-state variant matrix from `03-COMPONENTS.md`. A
component set without a `focus` variant is not finished.

---

## Step 6 — Composite components

9. `Card`
10. `ScoreMeter`
11. `StatTile`
12. `DataRow` → `LeadRow`
13. `Table`
14. `EmptyState`, `Skeleton`
15. `Topbar`, `Sidebar`, `Tabs`
16. `Modal`, `Sheet`, `Toast`, `Banner`
17. `KeyHint`
18. `TimezoneMeter`, `VerifyBadge`, `ProofChip`
19. `DraftEditor`, `FollowUpTimeline`

---

## Step 7 — Patterns & screens

Compose, don't redraw. Every screen is instances of the above.

Screens to build at **lg** and **xs**:

- Inbox (populated) · Inbox (empty) · Inbox (loading skeleton)
- Lead detail
- Draft review — **with a visible unverified claim**, because that's the product's
  most important state
- Follow-ups
- Settings
- Weekly review

---

## Component conventions

**Naming:** `Group/Name` — `Controls/Button`, `Data/LeadRow`, `Icons/clock-overlap`.

**Variant properties:** `variant`, `size`, `state`, `theme`. Boolean props prefixed
`has` or `is` — `hasIcon`, `isLoading`.

**Auto-layout everywhere.** Absolute positioning only for badges and focus rings.

**Padding and gaps bind to `space/*` variables.** Typing `16` where `space/5`
exists means the next spacing change is a manual sweep through every component.

**Real content.** Every instance ships with real strings — `Reef Technologies`,
`Senior Python Backend Engineer`, `$45–70/hr`, `8h overlap`, a real drafted email.
Never Lorem, never "Card Title", never "Label".

---

## Check before you call it done

- [ ] Zero hardcoded hex outside `primitive/colour`
- [ ] Every semantic token resolves in **both** Light and Dark
- [ ] Every text style sets `opsz` to its render size
- [ ] `WONK 1` appears only at 32px and above
- [ ] Six states on every interactive component set
- [ ] Focus ring visible on both themes, everywhere
- [ ] Radius comes from `radius/*` — six distinct values in use, not one
- [ ] Space above headings ≈1.6× space below
- [ ] No stock icons anywhere in the file
- [ ] No component contains placeholder text
- [ ] Every screen built at both `lg` and `xs`
- [ ] Body text contrast ≥4.5:1 in both themes; UI edges ≥3:1
- [ ] `text/faint` used only for placeholders and disabled states
