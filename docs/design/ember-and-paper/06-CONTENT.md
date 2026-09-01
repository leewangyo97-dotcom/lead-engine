# 06 — Content & voice

Words are design material. A perfectly crafted layout full of "No data available"
still reads as generated — this file is as much of the human-not-robot brief as
the typography is.

---

## Voice

**Plain, direct, warm, unhurried.** Write from the user's side of the screen.

- Name things as a person recognises them — *notifications*, not *webhook config*
- Active voice, present tense
- Contractions are fine. "You'll", "don't", "it's"
- Say the specific thing. "Reef Technologies replied" beats "You have 1 new message"
- Never apologise for the software's behaviour, and never blame the user

### Banned

"Oops!" · "Uh oh!" · "Something went wrong" · "Please try again later" ·
"Invalid input" · "An error occurred" · "Loading..." · "No data available" ·
"Awesome!" · "Success!" · exclamation marks in general · emoji in UI chrome

---

## Buttons

The label says what happens. Then the confirmation says it happened, in the same word.

| Do | Don't |
|---|---|
| `Create draft` → toast `Draft created` | `Submit` → `Success!` |
| `Archive` → row collapses | `OK` |
| `Copy email` → button reads `Copied` | `Copy to clipboard` |
| `Send to Gmail` | `Proceed` |
| `Discard` | `Cancel` (when it destroys work) |

Never `Yes` / `No` on a destructive confirm. `Discard draft` and `Keep editing` tell
you what each does without reading the question again.

---

## Empty states

Every empty state answers: what is this, why is it empty, what now.

| Screen | Copy |
|---|---|
| Inbox, no leads yet | **Nothing harvested yet.** The nightly run happens at 4am Manila time. If you'd rather not wait, run it now. → `Run harvest` |
| Inbox, all triaged | **You're through today's list.** Seven leads, four drafted. Next run is tomorrow at 4am. |
| Search, no results | **No leads match "kotlin remote".** Try a single word, or clear the filter to see all 34. → `Clear filter` |
| Follow-ups, none due | **Nothing due.** Follow-ups appear here on day 4 and day 11 after you send. |
| Drafts, none | **No drafts yet.** Press `E` on any lead to write one. |
| Source failed | **RemoteOK didn't respond last night.** The other two sources ran fine — 31 leads came in. → `Retry now` |

Note what these do: give a real number, explain the mechanism, offer one action.
"No items found" does none of those things.

---

## Errors

State what happened, then what to do. No apology, no vagueness, no blame.

| Situation | Copy |
|---|---|
| Gmail not connected | **Gmail isn't connected.** Drafts can't be created until it is. → `Connect Gmail` |
| Draft failed | **Couldn't create the Gmail draft.** The text is saved here, so nothing is lost. → `Try again` |
| Unverified claim | **This says "reduced crashes by half".** PROFILE says 35%. Fix the number or cite a different result. |
| DB unreachable | **Can't reach the database.** Neon suspends after 5 minutes idle; this usually clears in a few seconds. → `Retry` |
| Rate too low warning | **You're asking $40/hr.** Twelve comparable APAC contract roles this month posted a median of $58. |
| Validation | **Subject line is 78 characters.** Gmail truncates around 60 on mobile. |

The unverified-claim message is the model for all of them: name the exact text,
name the actual fact, say what to do. No "validation failed".

---

## Labels & microcopy

| Instead of | Write |
|---|---|
| "Score: 95" | `95` under a `SCORE` label — the number is the content |
| "Timezone compatibility: High" | `6h overlap` |
| "Contract: Yes" | a `Contract` chip, or nothing |
| "Last updated 2026-09-01T04:00:00Z" | `Harvested 4am today` |
| "0 results" | `Nothing here yet` |
| "Are you sure?" | `Discard this draft?` |
| "Settings saved successfully" | `Saved` |

**Dates:** relative under 7 days (`2 days ago`, `yesterday`, `4am today`),
absolute beyond (`12 Aug`). Never ISO timestamps in the UI.

**Numbers:** tabular figures always. Currency as `$58/hr`, never `USD 58.00`.

---

## Tone by moment

| Moment | Tone |
|---|---|
| Routine action | Invisible. Say nothing, or one word |
| Good outcome | Quiet and factual. `Draft created` — not `Nice work!` |
| Error the user caused | Neutral and specific. No "invalid" |
| Error the system caused | Plain and accountable. Say what happened |
| Destructive confirm | Direct. Name what is lost |
| Empty | Warm and useful. This is the one place a little personality belongs |

---

## The test

Read every string aloud. If you wouldn't say it to a colleague standing next to
you, rewrite it.

Nobody says "An error occurred while processing your request." They say
"That didn't save — the connection dropped."
