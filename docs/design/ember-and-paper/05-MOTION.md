# 05 — Motion

Motion here is confirmation, not decoration. This is a tool used daily; anything
that delights on day one irritates by day thirty.

**Test for every animation: does this tell the user something?** If not, cut it.

---

## Duration

| Token | ms | Use |
|---|---|---|
| `dur/instant` | 90 | hover, focus, colour shifts |
| `dur/quick` | 140 | toggles, checkboxes, chips |
| `dur/base` | 200 | dropdowns, tooltips, accordions |
| `dur/enter` | 260 | modals, sheets, panels appearing |
| `dur/exit` | 180 | anything leaving — **always faster than entering** |

Exits are quicker than entrances. Waiting for something you dismissed is the most
irritating 100ms in software.

---

## Easing

```
ease/out      cubic-bezier(0.22, 1.00, 0.36, 1.00)   things arriving
ease/in       cubic-bezier(0.55, 0.00, 0.85, 0.30)   things leaving
ease/standard cubic-bezier(0.40, 0.00, 0.20, 1.00)   things moving in place
ease/spring   cubic-bezier(0.34, 1.42, 0.64, 1.00)   toggles, checkmarks ONLY
```

`ease/spring` overshoots slightly. That tiny bounce is the difference between a
switch that *flips* and one that merely changes state — and it's the one place
where a hint of physicality earns its keep. **Restrict it to switches, checkboxes
and the verify checkmark.** Everywhere else it looks unserious.

---

## The catalogue

| Element | Motion |
|---|---|
| Button hover | background `dur/instant` `ease/standard` |
| Button press | `scale(0.985)` `dur/instant` |
| Row hover | background `dur/instant`; **no transform** |
| Row select | stripe widens 3→4px, `dur/quick` `ease/out` |
| Checkbox | check path draws over `dur/quick` `ease/spring` |
| Switch | thumb travels `dur/quick` `ease/spring` |
| Tooltip | fade + 2px rise, `dur/base` `ease/out`, 400ms delay |
| Dropdown | fade + 4px rise, `dur/base` `ease/out`, origin at trigger |
| Modal | scrim fades `dur/base`; panel scales 0.97→1 + fades, `dur/enter` `ease/out` |
| Sheet | slides from bottom `dur/enter` `ease/out`; drag-to-dismiss follows the finger 1:1 |
| Toast | slides up 12px + fades, `dur/enter`; exits `dur/exit` |
| Tab underline | slides `dur/base` `ease/standard` |
| Skeleton | shimmer 1.4s linear, infinite |
| Progress (indeterminate) | 30% segment, 1.2s `ease/standard`, infinite |
| Page transition | content fades `dur/base`; **no slide** |

---

## Explicitly no motion

| Element | Why |
|---|---|
| **ScoreMeter fill** | The user is scanning a list. An animating number is unreadable for 400ms, which is the entire time he looks at it |
| **List load** | No staggered cascade. Ten rows appearing one by one costs a second and communicates nothing |
| **Number counters** | Counting up from zero is a party trick that makes data slower to read |
| **Parallax, anywhere** | — |
| **Icon micro-animations on hover** | Forty icons all wiggling is noise |
| **Auto-playing anything** | — |

---

## Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Then check every state is still legible without transition — a tooltip that only
becomes visible *through* a fade disappears entirely under this rule. Opacity and
transform changes must still land at their final values.

---

## Micro-interactions worth having

Three. Not thirty.

1. **Verify checkmark.** When `verifier` passes a draft, the check draws in over
   200ms with `ease/spring`. This is the moment the product says "this is safe to
   send" — it deserves the one flourish on the screen.

2. **Copy confirmation.** The button label swaps to "Copied" and the fill shifts to
   `status/go` for 1.6s, then returns. No toast — the button *is* the feedback, and
   a toast for a copy is bureaucracy.

3. **Row dismissal.** On archive, the row collapses its height to 0 over
   `dur/exit`, and rows below move up with `ease/standard`. The list closing the gap
   is what makes the action feel completed rather than merely accepted.
