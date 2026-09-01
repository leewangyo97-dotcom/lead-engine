# Ember & Paper — Design System

A design system for **Lead Engine**, a tool one person opens every weekday morning.

**Direction:** warm editorial. Ink on paper, not pixels on a screen.
**Constraint that shapes everything:** it should look *made*, not generated.

---

## Feeding this to a Figma agent

Read the files in order. Build in the order given by `07-FIGMA-BUILD.md` — it is a
dependency chain, not a table of contents.

```
Read 00-DIRECTION.md and 01-FOUNDATIONS.md, then build the design system in
Figma following 07-FIGMA-BUILD.md exactly, starting with the variable
collections. Do not build any component before its variables exist.
```

If you're building in code instead, the same files work — every token is given as
a name plus a value, and `01-FOUNDATIONS.md` maps cleanly to CSS custom properties.

---

## Files

| File | What's in it |
|---|---|
| `00-DIRECTION.md` | The thesis. Why AI-assisted design looks robotic, and the seven mechanisms that fix it |
| `01-FOUNDATIONS.md` | Colour (with verified contrast), type, spacing, radius, elevation, grid |
| `02-ICONS.md` | 40 custom icons — construction rules and the deliberate quirks |
| `03-COMPONENTS.md` | 30 components with anatomy, variants and all six states |
| `04-RESPONSIVE.md` | Five breakpoints, what changes at each, touch and keyboard |
| `05-MOTION.md` | Durations, easing, the catalogue — and what gets no motion |
| `06-CONTENT.md` | Voice, empty states, errors. Words are design material |
| `07-FIGMA-BUILD.md` | Exact build order, conventions, and the done checklist |

---

## The five decisions that define it

**1. Fraunces with `WONK=1` on display type.** Fraunces carries a literal wonkiness
axis that swaps in eccentric letterforms — a curled *g*, an angled *y*. This is the
hand in the work, and it's the highest-leverage decision in the system. Off below
20px, where it stops reading as character.

**2. Radius by role, not one global value.** Six values: 3px chips, 5px buttons,
8px cards, 12px modals, 20px hero, full for avatars. Uniform `rounded-lg` on
everything is the clearest signal that nothing was decided.

**3. Asymmetric vertical rhythm.** Space above a heading is ~1.6× the space below
it. A heading belongs to the text under it. This one ratio does more for perceived
craft than any amount of colour work.

**4. Forty custom icons.** A stock icon set is the fastest route to looking like
every other app. Each icon here carries a small deliberate irregularity — the
search handle sits at 43°, the clock reads 10:08, the star's top point is half a
pixel longer.

**5. Warm mixed neutrals, never pure black or white.** Near-black is `#1B1A16`;
the ground is `#F2F1EA`. Every grey is biased toward the ember accent. Real ink and
real paper are never neutral.

---

## Continuity

This evolves the Lead Engine dashboards rather than replacing them. Ember `#C2451F`
and Fraunces carry over; the ground warms from cool slate-green to warm greige, and
the body face moves to Instrument Sans — a typeface its own designers describe as
balancing precision with *"subtle notes of playfulness"*, which is this brief in
six words.

Both themes are designed, not inverted. All contrast ratios in `01-FOUNDATIONS.md`
are verified against WCAG AA.
