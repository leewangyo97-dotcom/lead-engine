# Design

<!-- Written 10 Oct 2026 from the built system, after the Pivora restyle. Tokens live in
     app/globals.css (colour) and tailwind.config.ts (type, radius, spacing). Change a token
     there, never a hex in a component. -->

## Direction

A calm operator's console, after the user's pinned reference — the Pivora CRM dashboard on
Dribbble (https://dribbble.com/shots/26737102-Pivora-CRM-dashboard). Cool neutral ground,
white working surfaces on hairline borders, and one violet accent spent only on what is
selected or current. It replaced a warm paper, ink and terracotta look with a serif display.

Mode: **Operate** — scanability and consistency outrank expression. Desktop first; phone
secondary (PRODUCT.md).

## Colour

Restrained: neutrals plus one accent; statuses only where they mean something.

| Role | Light | Dark |
|---|---|---|
| canvas (page) | `#ffffff` | `#0e0e12` |
| surface (cards) | `#ffffff` | `#15151a` |
| sunk (sidebar, segmented track) | `#f7f7f8` | `#111115` |
| hover / selected | `#f1f1f4` | `#1d1d24` / `#22222a` |
| text primary / secondary / muted / faint | `#1b1b21` / `#4b4b56` / `#6a6a76` / `#72727e` | `#f1f1f4` / `#c6c6d0` / `#a0a0ac` / `#8b8b97` |
| rule default / soft / strong | `#e4e4e9` / `#ebebef` / `#d2d2da` | `#26262e` / `#1f1f26` / `#34343e` |
| accent / hover / tint | `#6c4ae6` / `#5d3ad9` / `#efebfd` | `#8f75f0` / `#ad98f6` / `#241d3d` |
| go / hold / stop (text on tint) | `#157a43` / `#9a5b07` / `#c42b2b` | `#4cc283` / `#e9a64c` / `#f07272` |

Every text colour clears 4.5:1 on its surface. Dark follows the system setting
(`prefers-color-scheme`), or `data-theme` on `<html>` overrides it.

## Type

Geist for every word, Geist Mono for counts and measurements only (scores, rates, overlaps,
code) — never as a "technical" costume for prose.

| Token | Size / weight | Use |
|---|---|---|
| `display-lg` | 30 / 600, -0.025em | KPI figures |
| `heading-lg` | 22 / 600, -0.02em | page titles |
| `heading-md` | 17 / 600 | sub-sections |
| `subhead` | 15 / 550 | top-bar section name, card titles |
| `body` / `body-sm` | 14 / 13, 400 | text |
| `label` | 13 / 600 | **section headings, sentence case** — never uppercase-tracked |
| `data-lg` | 24 / 600 | scores |
| `data` / `data-sm` | 13 / 12 | table figures, chips, counts |
| `caption` | 12 / 400 | captions |

Figures that line up use `tabular-nums`.

## Shape and space

- Radius: `xs` 4, `sm` 6 (chips, segments), `md` 8 (controls, nav items), `lg` 12 (cards),
  `xl` 16.
- Spacing scale is **replaced**: keys 0–12 only (`1`=2px, `2`=4, `3`=8, `4`=12, `5`=16,
  `6`=20, `7`=24, `8`=32 …). Off-scale values use arbitrary syntax (`py-[7px]`); a
  missing key emits nothing silently, and `tests/spacing-scale.test.ts` guards it.
- Depth: a 1px border first. `shadow-raised` (soft, offset) only for what sits above the
  plane — the active nav item, the active segment; `shadow-overlay` for popovers.

## Components

- **Shell** (`app/components/shell.tsx`): full-height `sunk` sidebar, 248px — brand block,
  sections with 18px outline icons, right-aligned plain counts, the active item a white
  card (`ring-1 ring-rule` + `shadow-raised`), and the engine's health as a card at the
  foot. A 64px top bar names the current section. Below 900px the sidebar becomes a brand
  row over a horizontally scrolling strip.
- **KPI cards** (`stat-tiles.tsx`): separate bordered cards on a 12px gap — label,
  `display-lg` figure, muted caption.
- **Segmented control** (Inbox ranges): `sunk` track with a hairline ring; the active
  segment is a raised white pill.
- **Chips** (`Pill`): 12px medium on a tint — go / hold / neutral; status values read as
  words (`needs draft`, not `needs_draft`).
- **Tier**: an 8px dot (live = go, reachable = hold, long shot = strong rule). No coloured
  stripes down rows.
- **Buttons**: primary filled accent; secondary white with a `rule` border; 8px radius.
- **Tables**: hairline row rules, sentence-case headers, tabular figures.

## Refuse

Uppercase tracked labels, serif display faces, gradient text, glass as decoration, coloured
borders or stripes wider than 1px on rows or cards, hard offset shadows, emoji or Unicode
standing in for icons, nested cards.
