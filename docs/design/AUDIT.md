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
real data: every send went out on Wednesday 9 September, so the first rung comes
due on 13 September.

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

## weekly-review-lg (3:1627)

The design has a dated subtitle, five stat tiles, a Score Distribution card, a
Top Sources ranking and a Response Rate by Day column chart.

Score Distribution is now built (`lib/review/distribution.ts`, one query over
the newest score per lead, five bands high-first, bars scaled to the largest
band). It answers something the outcome tables structurally cannot: they only
see leads that were sent something, so a scorer collapsed into one band reads as
silence rather than as a fault. Against production it draws 0 / 6 / 51 / 66 / 49
across the five bands.

The rest stays out:

- **The date range.** 3:1662 reads "Aug 25 - Sep 1". This review is not windowed
  — with fifteen sends in total, a seven-day window would be empty most weeks —
  so the page says "all time" rather than printing a range the numbers do not
  obey.
- **Response Rate by Day as bars.** The data is there and the app already shows
  it as a table, which withholds a rate below five sends. Bars cannot withhold:
  a column drawn at 0% and a column withheld for lack of evidence look the same,
  and the whole point of that rule is that they are not.
- **Top Sources.** Lead counts per source are on `/settings`, where the source
  list already lives. This page is about outcomes.
- **Stat tiles.** The inbox has them. Repeating them here would be a second
  place for the same numbers to be right or wrong in.

## The small-screen set, closed out

`draft-review-xs` (3:2076), `follow-ups-xs` (3:2128), `settings-xs` (3:2209) and
`weekly-review-xs` (3:2290) are mobile layouts of screens already audited above.
They carry the same chrome as the other xs frames — iOS status bar, MobileTopBar,
fixed MobileBottomNav — and the same divergences already recorded for it, plus
the pinned action bars noted for `lead-detail-xs`. Nothing in them changes a
decision made above. That closes all seventeen frames.

## The mock's numbers are illustrative, and contradict each other

Worth writing down because it is a trap: the same value differs between frames,
so no figure in this file is a specification.

| Thing | Large frame | Small frame |
|---|---|---|
| Score bands | 0-20, 21-40, 41-60, 61-80, 81-100 (3:1696) | <70, 70-79, 80-89, 90-100 (3:2323) |
| Scoring weights | 35 / 25 / 20 / 10 / 10 percent (3:1584) | 0.4 / 0.3 / 0.3 (3:2256) |
| Weight names | Stack match, Seniority, Timezone overlap, Company revenue, Contract preference | Django experience, Remote time overlap, SaaS profile match |
| Minimum score | 60 (3:1620) | 70 (3:2276) |
| Auto-archive | 30 days (3:1625) | 14 days (3:2280) |
| Sources | RemoteOK, WeWorkRemotely, LinkedIn Jobs | Hacker News Ask, Indeed SaaS feed, YC Work at a Startup |

The Gmail account differs too — `alex.prokhorov@gmail.com` in one, "Connected as
Alex" in the other — which is the clearest sign that this is a person's name in
a mock rather than anything to implement.

So: take structure, hierarchy and component anatomy from these frames. Take no
number. The real thresholds live in `lib/scoring/*` and `memory/RUBRIC.md`, and
the score bands built for `/review` are the large frame's because five bands of
twenty divide the range evenly, not because the mock is authoritative.

## The icons, closed

The shell drew its six sidebar icons as inline Lucide paths, which the earlier
pass recorded as "the one place this shell is not traceable to a node". Checked
properly, they were not merely untraced but different: Figma's `Icons/inbox`
(3:306) is a squarer tray — `M3 12H7L9 15H15L17 12H21M3 12V19H21V12M3 12V5M21
12V5`, straight sides from 3 to 21 — where Lucide's has an angled lid, and every
symbol in the file strokes at 1.5 against the 1.75 this drew at.

Five of the six are now the design's own, each named to its symbol:

| Sidebar item | Symbol | Node |
|---|---|---|
| Inbox | `Icons/inbox` | 3:306 |
| Find prospects | `Icons/search` | 3:310 |
| Follow-ups | `Icons/calendar` | 3:308 |
| All leads | `Icons/list` | 3:307 |
| Settings | `Icons/settings` | 3:309 |
| Weekly review | none | — |

Primitives are kept as the SVG export gives them — `circle`, `rect`, `path` —
rather than converted to path data by hand, a step that can only introduce
error. `Icons/list` fills its three bullets rather than stroking them, and
`Icons/settings` is two concentric circles rather than a toothed gear; both are
now drawn as the file draws them.

The sixth is honest about itself. The set has no chart glyph at any of the
positions checked (3:306-311, 3:316-317, 3:320), and walking all forty symbols
to be certain was not worth it for one sidebar item, so `review` stays a hand
drawing at the same box and weight, marked in the source as having no
counterpart.

The other 34 symbols are not imported. Nothing uses them, and a component
library nobody calls is a maintenance cost with no reader.
