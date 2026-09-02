# Figma audit — 2026-09-02

File `a9lK1MlQO1HzY2MvKsVZXz`, audited with the Figma MCP against the running app.

## Foundations: faithful

All 25 colour primitives exposed as Figma variables match `app/globals.css`
exactly — paper/50–500, ink/300–700, ember/300–700, night/500–900, hold/100–500,
stop/100.

All six typography tokens match `tailwind.config.ts` exactly, including
letter-spacing once Figma's percentages are read as such: `label` letterSpacing
9 is `0.09em`, `display/xl` -2.2 is `-0.022em`, `body/sm` 0.4 is `0.004em`.

| Token | Figma | Code |
|---|---|---|
| display/xl | Fraunces 700, 44px, 1.02, -2.2% | same |
| subhead | Instrument Sans 600, 16px, 1.4 | same |
| body | 400, 14.5px, 1.6 | same |
| body/sm | 400, 13px, 1.55, 0.4% | same |
| label | 600, 11px, 1.25, 9% | same |
| caption | 400, 12px, 1.45, 0.6% | same |

## Screens: structurally faithful

`inbox-populated-lg` (3:787) specifies a 56px topbar, a 220px sidebar, five stat
tiles labelled HARVESTED / DRAFTED / SENT / REPLIED / SCORE AVG, a three-tab row,
keyboard hints, 48px data rows and a footer tip. The implementation carries all
of these, in that order.

`lead-detail-lg` (3:968) specifies two things the app did not have: a count
beside each sidebar section that holds work, and an engine-health line at the
foot of the sidebar. Both are now implemented from data the app already had —
the counts in one query rather than one per section, and the health dot from the
`sources` table, so a source that has been dead for two days can no longer sit
behind the words "All systems normal".

Its nav names differ from the app's (Verified Leads, Email Drafts, Analytics
against All leads, Follow-ups, Weekly review) and it lays the lead view out as a
list beside a detail panel where the app uses a page per lead. Those are not
treated as drift: the design predates the features, and the nav has since grown
a prospects section the design has no concept of.

## Drift found and fixed

**Ten dead utility classes.** The project replaces Tailwind's spacing scale with
its own 0–12 keys, so `h-14`, `w-44`, `w-64`, `w-80`, `h-16`, `h-40`, `w-24`,
`w-20` produced no CSS at all. They were invisible because a stale `.next` build
still carried rules from an older config; on a clean build the topbar collapsed
from its intended 56px to 25px. All ten are now explicit arbitrary values.

**Radius.** `sm` was 5px against Figma's 4px and `xl` was 20px against Figma's
16px. Both corrected. `full` stays 999px rather than Figma's 99px — visually
identical at any real size. `xs` (3px) has no Figma counterpart and is kept: it
is the chip radius the components draw at.

## Known, deliberate divergence

**Spacing indices do not line up.** Figma's scale is 0, 4, 8, 12, 16, 24, 32, 40,
48, 64, 80, 128, 160. The code's is 0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 56, 72,
96 — it interleaves 2px and 20px and stops at 96px. Every layout in the app is
built on the code's indices, so renaming them would move every padding at once.
Adding Figma's missing large steps as keys 13–17 was tried and reverted: it
changed rendering (`h-14` stopped falling through) for no gain, since nothing
uses them. Sizes above 96px use arbitrary values.

## Not verifiable

`go/*`, `hold/200`, `stop/200` and `stop/400` appear as swatches in the
foundations page but are not bound to Figma variables, so the MCP cannot report
their values. The code's `go` ramp is therefore unverified against the design.
Interpolated values were written and then reverted rather than presenting a
guess as a design token.
