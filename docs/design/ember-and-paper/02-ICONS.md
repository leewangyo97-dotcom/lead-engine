# 02 — Icons

Forty icons, drawn to our grid. **This is the single biggest lever against a
generic feel** — a stock icon set is the fastest way to make a considered layout
look like everyone else's.

Build these as Figma components in a dedicated `Icons` page, each a 24×24 frame.

---

## Construction

| Rule | Value |
|---|---|
| Frame | 24 × 24 |
| Live area | 20 × 20 — 2px optical padding on all sides |
| Stroke | **1.5px**, centre-aligned, expanded to outlines on export |
| Caps | Round |
| Joins | Round |
| Minimum joint radius | 1px — no sharp interior corners anywhere |
| Grid snap | 0.5px (not 1px — half-pixel is where optical corrections live) |
| Colour | `currentColor`, single path group, no fills except where noted |

### Optical weight correction

Horizontal strokes read heavier than vertical ones at the same width. So:

- Vertical strokes: **1.5px**
- Horizontal strokes longer than 12px: **1.4px**
- Diagonals: **1.45px**

Nobody will consciously notice. Everybody notices the set that skips it.

### The deliberate quirks

Perfect symmetry is what makes an icon set feel machine-made. Each of these is
small enough to be invisible and enough to change the feel.

| Icon | The quirk |
|---|---|
| `search` | Handle at **43°**, not 45° — and it overshoots the circle by 0.5px |
| `star` | Top point **0.5px longer** than the other four |
| `folder` | Tab sits left of centre, ends at 42% width |
| `send` | Paper-plane fold is asymmetric; glyph offset **+1px right** in the frame |
| `check` | Long arm 1.5× the short arm, not 2× — friendlier proportion |
| `bell` | Clapper slightly off-centre, as a real bell hangs |
| `clock` | Hands at 10:08 — the watchmaker's angle, never 12:00 |
| `bookmark` | Notch depth 40% of width, not 50% |
| `mail` | Envelope flap dips 1px below the true midpoint |
| `user` | Head circle 1px smaller than geometric centre wants |

### Curves

Use two-point béziers with handles at ~55% (not the default 55.2% circle
approximation) so curves are almost-but-not-quite circular. Never build an organic
shape from a perfect ellipse.

---

## The set

### Navigation & structure (6)
`inbox` · `list` · `calendar` · `settings` · `search` · `menu`

### Actions (10)
`send` · `edit` · `copy` · `archive` · `trash` · `refresh` · `filter` ·
`external-link` · `download` · `plus`

### State & status (8)
`check` · `check-circle` · `alert-triangle` · `x-circle` · `clock` · `pause` ·
`spark` (new / fresh lead) · `flame` (hot lead — the ember motif)

### Lead domain (8)
`company` (building, tab off-centre) · `person` · `globe` (timezone) ·
`clock-overlap` (two arcs, overlapping — custom, our own idea) ·
`contract` (document with a fold) · `money` · `trigger` (a small burst) ·
`source` (a branching line)

### Communication (4)
`mail` · `mail-draft` (envelope with a pencil) · `reply` · `thread`

### Utility (4)
`chevron-right` · `chevron-down` · `more-horizontal` · `drag-handle`

---

## `clock-overlap` — the signature icon

Draw this one first and draw it properly. It represents timezone overlap, which is
the most important variable in the product, and it exists nowhere else. A custom
icon for your most important concept is what a design system is *for*.

**Construction:** two arcs of the same radius, offset horizontally by 6px, with the
intersection drawn at full stroke and the outer portions at 1.2px. The overlap
region is the meaning. Do not fill it — let the doubled stroke carry it.

---

## Sizes

| Token | Size | Stroke | Use |
|---|---|---|---|
| `icon/sm` | 16 | 1.35px | inline with `body/sm`, chips |
| `icon/md` | 20 | 1.5px | buttons, list rows — **default** |
| `icon/lg` | 24 | 1.5px | section headers, empty states |
| `icon/xl` | 40 | 1.75px | empty-state illustrations |

**Stroke is re-drawn per size, never scaled.** A 24px icon scaled to 16px gives you
a 1px stroke that looks anaemic beside 1.5px siblings. Draw three masters.

---

## Alignment with text

Icons align to the **x-height** of adjacent text, not to its bounding box or its
cap height. In Figma this usually means nudging the icon **down 1px** from what
auto-layout centre gives you.

Gap between icon and label: `space/3` (8px) at `icon/md`, `space/2` (4px) at `icon/sm`.

---

## Rules

1. **Never mix in a stock icon.** One Lucide glyph among forty custom ones is
   immediately visible and undoes the set.
2. **No filled and outlined variants of the same icon** unless the fill carries
   meaning (e.g. `bookmark` filled = saved).
3. **Icons never carry meaning alone.** Every icon-only control needs a `title` and
   an `aria-label`. A tooltip is not an accessibility feature.
4. **No icon smaller than 16px.** Below that, 1.5px strokes collapse.
5. Export as SVG with `stroke="currentColor"` and no hardcoded colour, so a single
   component inherits theme.
