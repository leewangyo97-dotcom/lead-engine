# OUTREACH LOG

Once the app is running, this data lives in the `outreach` and `events` tables and
is queried with SQL — **never read this file whole into context.** This file is the
manual log for the pre-app period and the human-readable summary afterwards.

## Rules

- One row per first-touch email. Follow-ups update the same row.
- `angle` and `proof` are the columns the learning loop depends on. Never leave
  them blank — a send with no recorded angle teaches nothing.
- Log the outcome even when it's silence. `no_reply` after 14 days is data.

## Log

| Date | Company | Role | Angle | Proof led with | Outcome | Notes |
|---|---|---|---|---|---|---|
| _(2026-09-01: 12 drafts prepared in the outreach pack, none sent yet)_ | | | | | | |

## Angles in use

Keep this list short. A new angle needs a reason, and it needs to be tracked.

| Code | Opening move |
|---|---|
| `stack-exact` | Their listed stack is literally his — say so in line one |
| `offline-hard` | Name the hard problem in their post (offline sync, release automation) |
| `tz-preempt` | Raise the timezone objection first and answer it |
| `trigger-fund` | Reference the round they just closed |
| `paid-trial` | Offer a small paid trial task instead of an interview loop |
| `ask-direct` | Region-locked role — ask one direct question, accept a no |
| `bench-offer` | To consultancies: pitch availability, not candidacy |

## Standing rules for outreach

1. Every claim traces to `PROFILE.md`. No exceptions.
2. Five to seven lines. Anything longer gets skimmed and binned.
3. Open with them, not with "I am a developer with 7 years of experience".
4. One ask, and make it small — a reply, a call, a paid trial task.
5. Always include joshuasenining.dev and the WhatsApp number.
6. Never contact the same company twice inside 90 days.
7. Follow up on day 4 and day 11, then stop.
