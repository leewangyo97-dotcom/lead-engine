# UI Spec

## The governing idea

This is a tool for one person doing one thing every morning: decide who to contact
today. Not a CRM. Not analytics. **The whole day's list should clear in under two
minutes, using only the keyboard.**

If a screen doesn't serve that, it doesn't ship.

## Screens

### 1. Inbox — `/`

The only screen that matters. Everything else is a detour from here.

```
┌──────────────────────────────────────────────────────────────┐
│  Today · 7 new          [Live 4] [Reachable 2] [Long shot 1]  │
│  ─────────────────────────────────────────────────────────── │
│ ▌95  Doubling                    Senior Eng · 1099 contract   │
│      Remote US · 6h overlap      React Native · TS · GCP      │
│      ↳ posted 2 days ago                    [contract][direct]│
│ ─────────────────────────────────────────────────────────── │
│ ▌88  Reef Technologies           Senior Python Backend        │
│      EMEA/APAC · 8h overlap      $45–70/hr · min 30h/wk       │
│      ↳ rate above your ask                  [contract]        │
└──────────────────────────────────────────────────────────────┘
```

Per row: score, company, role, region **with computed overlap hours**, stack,
trigger event, and state pills. The left stripe is tier colour — a severity
encoding, so the shape of the day reads before any text does.

**Keyboard is the primary interface:**

| Key | Action |
|---|---|
| `j` / `k` | move down / up |
| `Enter` | open detail |
| `e` | draft email for this lead |
| `a` | archive (→ `parked`) |
| `x` | disqualify, with a one-key reason |
| `f` | flag for follow-up |
| `/` | filter |
| `?` | shortcut overlay |

Mouse works everywhere too. But the keyboard path is the one that must be fast.

### 2. Lead detail — `/lead/[id]`

Three blocks, no tabs, no accordions:

- **Why it scored** — the rubric line items with their contributions, so a wrong
  score is diagnosable rather than mysterious
- **The opening** — the trigger event, the timezone overlap, the suggested angle,
  and which of Joshua's proof points the copywriter selected
- **Source** — original posting text and a link out

### 3. Draft review — `/lead/[id]/draft`

Generated subject and body in an editable textarea. Below it:

- The `verifier` verdict, inline and unmissable. **Every factual claim is
  highlighted and traced to its line in `PROFILE.md`.** An unsupported claim shows
  red and blocks the button.
- `Create Gmail draft` — disabled until verified
- `Regenerate with a different angle` — dropdown of angles

The button creates a Gmail draft. **There is no send button.** That is a product
decision, not an omission — say so in a tooltip so it doesn't read as missing.

### 4. Follow-ups — `/followups`

Anything sent with no reply, with day-4 and day-11 drafts pre-written and waiting.
This screen exists because follow-up 2 is where most replies come from and it is
the step everyone skips.

### 5. Settings — `/settings`

Rubric weights (sliders, live-previewed against last night's leads so a change
shows its effect immediately), source on/off toggles, region blocklist, thresholds.

### 6. Weekly review — `/review`

Appears Fridays. Reply rate by source, by stack, by angle, by send day. One
evidence-backed suggestion for a rubric change, with Accept / Dismiss. Accepting
writes to `memory/DECISIONS.md`.

## Visual direction

Match the dashboards already built for Joshua so the whole system reads as one product:

- Ground `#EDF1EF` light / `#0E1413` dark — a cool green-grey, not neutral grey
- Accent `#C2451F` ember — score bars, active state, primary buttons only
- Semantic: `#17734F` eligible / `#8C5D08` reachable / `#5B6C73` long shot
- Type: Fraunces (headings), Archivo (UI), JetBrains Mono (scores, rates, dates)
- `font-variant-numeric: tabular-nums` on every column of digits

Define all colours as tokens on `:root`; redefine only tokens under
`@media (prefers-color-scheme: dark)` and `[data-theme="dark"]`. Never declare a
colour solely inside a media query.

## Explicitly not building

Charts on the inbox screen. Drag-and-drop pipelines. A rich text editor. Bulk
select. Notifications. Every one of these adds surface without making the two-minute
morning faster.
