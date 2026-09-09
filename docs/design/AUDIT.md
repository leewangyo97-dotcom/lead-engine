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

`draft-review-lg` (3:1098) is faithful in structure: the title, a badge on the
right for the verifier's verdict, each violation called out above the message,
labelled Subject and Email body boxes, and the offending sentence marked inside
the body — which the implementation does by splitting the text around the
verifier's quotes.

Its primary button says "Send to Gmail". The implementation says "Ready — run
`pnpm gmail:drafts`", or "Create Gmail draft — blocked until verified" when the
verifier has not passed it. That is the one departure the page has always
documented, and it is not negotiable: there is no send path in this repo, so a
button may not claim one.

Two smaller things the design has and the app does not: an arrow-left back
affordance beside the title, and an icon in the violation block. The app links
the company name back to the lead instead, which does the same job. Neither is
worth changing.

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

## Second pass: the empty, skeleton and small-screen states

`inbox-empty-lg` (3:1212) and `inbox-skeleton-lg` (3:1285) were built from the
design earlier and are recorded here for completeness: `app/components/empty-inbox.tsx`
carries the design's structure — a centred mark, a display-size line, one
sentence of specifics — and `app/loading.tsx` uses the design's placeholder
sizes. The empty state's copy is the design's shape with real numbers
substituted, because "Seven leads, four drafted" printed literally would be a
fabricated report.

The small-screen set is four frames at 360px: `inbox-populated-xs` (3:1794),
`inbox-empty-xs` (3:1877), `inbox-skeleton-xs` (3:1906) and `lead-detail-xs`
(3:1960). All four specify the same chrome — an iOS status bar, a 56px
MobileTopBar carrying the logo mark and a 32px control at the right, and a fixed
64px MobileBottomNav with four items. `lead-detail-xs` additionally pins its
actions to the bottom: a full-width "Draft email" over Archive and Flag.

## Drift found and fixed, second pass

**The lead page had no score above the fold.** Both frames put a
`Data/ScoreMeter` at the top right of the header — 3:1048 in `lead-detail-lg`,
3:1973 in `lead-detail-xs`, 52x36 in each. The
implementation showed the score only as the total of the "Why it scored" table,
four sections down the page. `ScoreMeter` in `app/components/pills.tsx` is now
the design's component — the number in data/lg over a 3px track filled to the
score in the tier's colour — and sits in the lead header. Verified against a
live lead: 52px track, 38px fill at score 73, amber for the warn tier.

**The schedule was written down twice and the copies had diverged.** Not a
Figma finding, caught while reading the inbox for this pass: `lib/health.ts`
computed the expected run time from `0 20 * * 1-5` while the workflow had moved
to `17 20`. Six hours of grace absorbed the seventeen minutes so it never showed
as a false fault. `tests/nightly-schedule.test.ts` now parses the workflow and
asserts the constants match it.

## Known, deliberate divergence, second pass

**No mobile bottom nav.** The design gives small screens a fixed bottom bar with
Inbox, Follow-ups, All leads and Settings. The app keeps one shell at every
width, and on a phone the sidebar becomes a horizontally scrollable strip under
the topbar. Two reasons it stays: the nav is six items rather than the design's
four (Find prospects and Weekly review both postdate these frames, and 86px per
item does not divide into 360 six ways), and a fixed bottom bar would have to be
duplicated as a second navigation component with its own active state. The strip
is worse for thumb reach and better for not lying about which sections exist.

**No mobile status bar, and no separate MobileTopBar.** The status bar is the
phone's own, drawn in the mock for realism; a web page cannot and should not
render one. The topbar is the same component at every width.

**Lead actions are not pinned to the bottom on a phone.** `lead-detail-xs` fixes
them there. In the app they sit in document flow after Key facts, which is where
the large frame puts them. Pinning would need a second layout for the same three
buttons, and the page is short enough that they are one scroll away.

## follow-ups-lg (3:1411)

The design draws the ladder as a track — Sent, Day 4, Day 11, joined by lines,
each rung filled or not — beside a SENT date and a "View draft" action, under a
"3 due today" count. The implementation said "step 2 · 6d since last touch",
which asks the reader to remember what step 2 means and how many rungs are left.
`LadderTrack` in `app/followups/page.tsx` now draws the three rungs from
`ladderRungs()` in `lib/followups.ts`, so the labels come from `LADDER_DAYS`
rather than being written twice, and the count sits under the heading per
3:1431. The rung states are unit-tested; the track has not yet been seen with
real data: all five sends went out on Wednesday 9 September, so the first rung
comes due on 13 September.

The SENT date column and the "View draft" button are not added: the row already
carries days-since-last-touch, and there is no draft to view until `/daily-run`
writes one.

## Drift found and fixed: three more dead spacing classes

The earlier pass found ten utilities that produced no CSS because this project
replaces Tailwind's spacing scale rather than extending it. Three were still
live, found by measuring elements in the browser:

- `py-0.5` — every sidebar count badge, every `kbd` key on the inbox, the
  keyboard hint in the lead actions, and the Reach chips on `/prospects`. All
  had zero vertical padding. Now `py-1` (2px).
- `h-1.5 w-1.5` — the green overlap dot on the lead page, 0x0 and therefore
  invisible since it was written. Now `h-[6px] w-[6px]`, which is the size of
  Figma's ellipse (3:1983).
- `py-16` — the empty inbox card. Now `py-[64px]`.

`tests/spacing-scale.test.ts` reads the thirteen keys out of
`tailwind.config.ts`, scans every `.tsx` under `app/`, and fails naming the file
and the class. Confirmed to fail on an injected `py-0.5` and `md:h-14` before
being left green.

## settings-lg (3:1503)

The design has four cards: Sources with a "Run now" button and an enable switch
per source, a Gmail card carrying the account and a Connected badge, Scoring
weights as percentages, and Preferences as editable inputs for timezone,
minimum score and auto-archive days.

One of them was a real gap and is now built. The app had no way to learn that
the Gmail refresh token had expired except to run `pnpm gmail:drafts` and watch
it fail — which happens at the end of a daily run, not the start, and while the
consent screen is in Testing the token expires every seven days. `/settings` now
carries a Gmail card that asks Google directly (`lib/gmail/status.ts`, a token
refresh and nothing else) and reports connected, expired, not authorised or
failing, keeping `explainTokenFailure`'s wording so the line says which command
fixes it.

The rest stays out, for reasons already recorded on the page itself: the
switches and "Run now" need a write path and a way to trigger a harvest from the
web, and this pipeline is driven by cron and the CLI; the weights and
preferences are editable in the design, but they live in `memory/RUBRIC.md` and
in code, so a form would need a second source of truth that can disagree with
the first. Tuning a weight is a commit.
