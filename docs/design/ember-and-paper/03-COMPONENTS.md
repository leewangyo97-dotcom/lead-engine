# 03 — Components

Thirty components. Every one references **semantic tokens only** — no raw hex, no
literal pixel values outside the spacing scale.

Figma: one page per group, each component a component set with variant properties.
Use auto-layout everywhere; absolute positioning only for badges and focus rings.

---

## Universal states

Every interactive component implements all six. A component set missing `focus` is
incomplete, not "to do later".

| State | Treatment |
|---|---|
| `default` | — |
| `hover` | `bg/hover`, or accent shifts to `accent/hover` |
| `active` | scale `0.985`, no colour change |
| `focus` | `2px solid accent/base`, offset 2px, radius inherited |
| `disabled` | opacity `0.45`, `cursor: not-allowed`, **no colour change** |
| `loading` | spinner replaces icon, label stays, width locked |

**Disabled does not get its own grey.** Fading the real component keeps the layout
stable and stops the palette sprawling.

---

## 1. Controls

### Button
**Variants:** `primary` · `secondary` · `ghost` · `danger`
**Sizes:** `sm` (28h) · `md` (36h) · `lg` (44h)
**Props:** `iconLeading?` `iconTrailing?` `loading` `disabled` `fullWidth`

| Variant | Fill | Text | Border |
|---|---|---|---|
| primary | `accent/base` | `text/onAccent` | none |
| secondary | `bg/surface` | `text/primary` | `1px rule/strong` |
| ghost | transparent | `text/secondary` | none |
| danger | transparent | `status/stop` | `1px status/stop` |

Radius `radius/sm`. Padding per `01-FOUNDATIONS`. Label is `subhead` at `md`.

> **Danger is outlined, not filled.** A solid wine button competes with the ember
> primary and makes destructive actions look like the main path.

### IconButton
Square: 28 / 32 / 40. `icon/md` centred, optically nudged. Radius `radius/sm`.
Always has `aria-label`.

### Input
Height 38. `1px rule/strong`, radius `radius/sm`, `bg/surface`.
Placeholder `text/faint`. Focus swaps border to `accent/base` **and** shows the ring.
**Anatomy:** `label` (11px, uppercase) → 6px → field → 4px → helper/error.
Error: border `status/stop`, helper text `status/stop`, `alert-triangle` at 16px.

### Textarea
Same as Input. Min-height 96, resize vertical only. Character counter in
`data/sm`, `text/muted`, appearing only past 80% of the limit.

### Select
Input styling plus `chevron-down` at 16px, `text/muted`, 12px from the right edge.
Menu uses `elev/overlay`, `radius/md`, 4px internal padding, 32px rows.

### Checkbox / Radio
16×16. Checkbox `radius/xs`; radio `radius/full`. Unchecked `1.5px rule/strong`.
Checked `accent/base` fill with the custom `check` glyph in `text/onAccent`.
Hit area 40×40 minimum regardless of visual size.

### Switch
36×20 track, `radius/full`, 16px thumb, 2px inset.
Off `paper/400` / `night/500`; on `accent/base`. Thumb has `elev/raised`.

---

## 2. Content

### Card
`bg/surface`, `1px rule/default`, `radius/md`, padding `20 24`.
**Variants:** `flat` (default) · `raised` (`elev/raised`) · `accent` (3px left border in `accent/base`)
Use `accent` sparingly — at most one per view, or it stops meaning anything.

### Chip
Height 22, padding `3 8`, `radius/xs`, `label` type.
**Variants:** `neutral` · `go` · `hold` · `stop` · `accent`, each tint background + matching text.

### Badge
Numeric counter. Min-width 18, height 18, `radius/full`, `data/sm`, tabular.

### Avatar
Sizes 24 / 32 / 40, `radius/full`. Fallback = initials in `subhead` on `accent/tint`.

### Divider
`1px rule/soft`, full-bleed inside its container.
**Variant `labelled`:** rule — 12px gap — `label` text — 12px gap — rule.

### Tooltip
`ink/900` background (both themes — tooltips are the one deliberate inversion),
`paper/50` text, `body/sm`, padding `6 10`, `radius/xs`, `elev/overlay`.
Delay 400ms in, 100ms out.

---

## 3. Data

### ScoreMeter
The product's signature element. Number in `data/lg` above a 3px track.
Track `rule/soft`; fill coloured by tier (`status/go` / `status/hold` / `text/muted`).
Fill width = score %. `radius/full` on both.
**Never animate on load** — the user is scanning, not watching.

### StatTile
`label` (uppercase) → `data/lg` number → `caption` context line.
Grid of tiles separated by 1px `rule/default`, no individual borders — one shared grid.

### DataRow
Base for every list. Grid: `[3px tier stripe][score 52][primary 1.35fr][secondary 1.5fr][pills auto]`.
Padding `13 18`. Hover `bg/hover`. Selected `bg/selected` + stripe widens to 4px.
**Variants:** `default` · `selected` · `read` (primary text drops to `text/secondary`)

### Table
Header row: `label` type, `text/muted`, `1px rule/default` beneath.
Rows: `1px rule/soft` between. **No zebra striping** — rules do that job with less noise.
Numeric columns right-aligned and tabular.

### Sparkline
40×16, 1.5px stroke `accent/base`, 12% area fill, endpoint dot 2.5px.

### ProgressBar
4px track, `radius/full`, `accent/base` fill. Indeterminate = 30% segment travelling
across on a 1.2s loop.

### Skeleton
`bg/sunk`, `radius/xs`, shimmer 1.4s. **Match the real content's shape** — a
skeleton row must be the height of a real row, or the page jumps when it resolves.

### EmptyState
`icon/xl` in `text/faint` → 16px → `heading/md` → 8px → `body` in `text/secondary`
(max 46ch) → 20px → one `secondary` button.
Copy is specific and human — never "No data available". See `07-CONTENT.md`.

---

## 4. Navigation & feedback

### Topbar
Height 56, `bg/canvas`, `1px rule/default` beneath. Wordmark in `heading/md`
(Fraunces, WONK 0). Right side: search, then IconButtons, 8px apart.

### Sidebar
Width 220 (`md`+), collapsible to 60. Items 36 high, `radius/sm`, `icon/md` +
`body`. Active: `bg/selected`, `text/primary`, 2px `accent/base` left marker.

### Tabs
Underline style. Label `subhead`, `text/muted`; active `text/primary` with a 2px
`accent/base` underline. 20px gap. Underline slides between tabs in 180ms.

### Modal
`radius/lg`, `elev/overlay`, max-width 520, padding `28 32`.
Scrim `ink/900` @ 40%, 4px backdrop blur. Header `heading/lg`, actions bottom-right,
primary rightmost.

### Sheet
Mobile equivalent. Bottom-anchored, `radius/lg` top corners only, drag handle
(32×4, `rule/strong`, `radius/full`) centred at top.

### Toast
Bottom-centre, max-width 380, `bg/surface`, `elev/overlay`, `radius/md`,
padding `12 16`. Status icon + `body/sm`. Auto-dismiss 4s; errors persist until
dismissed.

### Banner
Full-width inline. `1px` border + tint background by status, `radius/md`, 3px left
border in the status colour. Icon, then `body/sm`, then optional action.

### KeyHint
The keyboard-shortcut chip — important here, because keyboard is the primary
interface. `data/sm`, padding `2 6`, `radius/xs`, `1px rule/default`, `bg/sunk`.
Rendered as `J` `K` `E`. Pairs render `⌘` `K` with a 3px gap.

---

## 5. App-specific

### LeadRow
`DataRow` + `ScoreMeter` + company/role text + `TimezoneMeter` + status Chips.
This is the component the user looks at most. Get its vertical rhythm right and
the product feels finished.

### TimezoneMeter
`clock-overlap` icon + `data/sm` ("6h overlap"). Colour by band:
≥6h `status/go`, 3–5h `status/hold`, <3h `text/muted`.

### VerifyBadge
Gates the Gmail draft, so it must be unmissable.
`verified`: `check-circle` + "Checked" in `status/go` on `status/go-tint`.
`unverified`: `alert-triangle` + the violation count in `status/stop` on `status/stop-tint`.

### ProofChip
Which résumé proof an email used. `neutral` Chip + 12px icon. Tooltip shows the
sourced line from PROFILE.

### DraftEditor
Subject field (Input, `subhead`) → Divider → body Textarea (`body/lg`, 1.65
line-height, 68ch max) → VerifyBadge → action row.
**Claim highlighting:** verified claims get a 2px `status/go` underline; unsupported
claims get a `status/stop-tint` background. This is the feature — make it visible.

### FollowUpTimeline
Horizontal: three nodes (sent → day 4 → day 11) joined by a 1px rule.
Complete `status/go` filled; pending `rule/strong` outlined; skipped `text/faint` dashed.

---

## Composition rules

1. Components never set their own outer margin. Parents own spacing via layout gap.
2. Never nest a Card inside a Card. If you want to, you want a Divider.
3. Maximum **one** `accent` element per view. The accent is a pointer, and a page of
   pointers points nowhere.
4. Every component ships with **real content** in Figma — real company names, real
   scores, real email text. Never "Lorem ipsum", never "Card Title".
5. Every component has both Light and Dark in its variant matrix, and both get
   looked at before it ships.
