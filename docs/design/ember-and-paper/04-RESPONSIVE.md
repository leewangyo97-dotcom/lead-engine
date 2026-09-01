# 04 — Responsive

Not "it shrinks". Each breakpoint is a different set of decisions about what
matters, because a phone at a bus stop and a desktop at 8am are different jobs.

---

## Breakpoints

| Name | Range | Columns | Gutter | Margin | The job |
|---|---|---|---|---|---|
| `xs` | 360–599 | 4 | 16 | 20 | check what's new, one-handed |
| `sm` | 600–899 | 8 | 20 | 24 | read and triage |
| `md` | 900–1199 | 12 | 24 | 32 | triage and draft |
| `lg` | 1200–1439 | 12 | 24 | 40 | **primary** — full workflow |
| `xl` | 1440+ | 12 | 32 | auto | same as lg, centred at 1240 max |

Design at `lg` first — that's where the work happens. Then design `xs`
deliberately, as its own layout. `sm` and `md` are interpolations; the two ends are not.

---

## Layout shifts

| Region | xs | sm | md | lg+ |
|---|---|---|---|---|
| Sidebar | hidden; bottom nav | hidden; drawer | 60 icon rail | 220 full |
| LeadRow | stacked, 2 lines | stacked, 3 lines | full grid | full grid + trigger |
| Score | inline before company | inline | own column | own column + meter |
| Detail view | full-screen route | full-screen route | 50% split | 40% side panel |
| Draft editor | full-screen sheet | full-screen sheet | modal 520 | side panel 480 |
| StatTiles | 2 across | 3 across | 5 across | 5 across |
| Filters | bottom sheet | bottom sheet | inline bar | inline bar |

### LeadRow at `xs`

The row carries five things at `lg`. At `xs`, three of them go.

```
┌─────────────────────────────────┐
│ ▌ 95   Doubling                 │   score + company, one line
│        Senior Eng · contract    │   role + the single most
│        6h overlap               │   decisive fact
└─────────────────────────────────┘
```

Dropped: stack list, trigger event, secondary pills. They're in the detail view.
**Cutting is the design decision.** Squeezing all five into a 360px row is what
"responsive" means when nobody made a choice.

---

## Type at small sizes

Sizes hold; only the display steps down. Body text shrinking on mobile is a
readability regression that reads as an accident.

| Token | xs–sm | md+ |
|---|---|---|
| `display/xl` | 32 | 44 |
| `display/lg` | 26 | 32 |
| `heading/lg` | 21 | 24 |
| everything else | unchanged | unchanged |

Set `WONK 0` on display below `md`. Wonk needs size to read as intent.

---

## Touch

- Minimum target **44 × 44**, even when the visual control is 16px — expand the hit
  area, don't inflate the design.
- Minimum 8px between adjacent targets.
- No hover-dependent affordances below `md`. Anything reachable only by hover must
  have a tap path.
- Bottom sheets over modals on touch — reachable with a thumb.
- Primary actions in the bottom third at `xs`. The top of a phone screen is the
  hardest place to reach.

---

## Keyboard is the desktop primary

At `md`+, keyboard is the main interface — the product's whole promise is clearing
a morning list in two minutes.

| Key | Action |
|---|---|
| `j` `k` | move down / up |
| `Enter` | open |
| `e` | draft |
| `a` | archive |
| `x` | disqualify |
| `f` | flag |
| `/` | filter |
| `Esc` | close, deselect |
| `?` | shortcut overlay |

Show `KeyHint` chips next to their actions in the UI, not only in a help modal. A
shortcut nobody discovers doesn't exist.

---

## Rules

1. **The page body never scrolls horizontally.** Wide content — tables, code,
   diagrams — scrolls inside its own `overflow-x: auto` container.
2. Images `max-width: 100%`, `height: auto`.
3. Reading columns cap at **68ch** no matter how wide the viewport.
4. Test every layout at **320px**. It's below our smallest breakpoint and it still
   must not break.
5. Design both themes at both ends. A dark `xs` layout is where contrast bugs hide.
