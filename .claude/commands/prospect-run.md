---
description: Write, check and work the prospect messages. The side of the funnel that produces something.
---

The lead funnel is supply-starved and honest about it — `pnpm leads:diagnose`
puts the average job lead at 33 of 100 against a threshold of 75. The prospect
funnel is where the reachable market is: 23,203 businesses, 7,643 with a phone or
an email. This is the loop for it, and until 11 September it was the only part of
the project with no command describing it.

No model is called by the server here. Steps 2 and 3 are the same
prompt-out/JSON-in pattern the lead run uses.

## Steps

1. **See what the queue holds.** `/prospects` with no search selected is the work
   queue: the best 25 to message next, one row per phone number, filterable by
   category and city with a count on each chip.

   ```bash
   pnpm leads:diagnose     # optional, and only if the inbox looks wrong
   ```

2. **Write the next batch of messages.**

   ```bash
   pnpm prospects:enhance > /tmp/enhance.txt
   ```

   Ten businesses, best-scoring first, skipping any that already have a draft —
   without that skip the same ten come back every run. Write the JSON and apply
   it:

   ```bash
   cat enhanced.json | pnpm apply:enhance
   ```

   Each message uses **only** the facts listed for that business. The batch is
   rejected whole if any message claims a signal the prospect does not have, and
   `verifyMessage` refuses text mentioning reviews, opening hours, a visit that
   did not happen, or being local to them. Messages are stored unsent; nothing
   here can mark one sent.

3. **Check them against reality.**

   ```bash
   pnpm drafts:verify
   ```

   Non-zero exit means a draft says something the site contradicts. Two of the
   first nineteen did: one told a business their site had no viewport tag and no
   contact details when it had both, and one told a business they had no website
   while their own email domain served a 349KB site.

   `unverifiable` is not a pass. It means nothing available settles the claim —
   usually because the business uses gmail and there is no domain to probe.

4. **Work the queue.** Click WhatsApp or Email on a row. The server decides what
   opens and logs it: a do-not-contact entry wins over a click, and the message
   recorded is the message that opens. Clicking twice within a day reopens the
   same message rather than counting a second send.

5. **Follow-ups.** `/followups` lists everything owed on both funnels. A prospect
   row links to that one business, whatever its status — the queue only shows
   `new`, and every row on the follow-up list has been contacted.

   Clicking the button sends the **follow-up**, not the opener: `followUpMessage`
   writes step 1 and step 2 from the trade and the step. Day 11 says it is the
   last one. There is nothing for a model to write.

6. **Record outcomes.** Replied, won or lost on the row. `/review` withholds a
   reply rate below five sends of the same angle, so the log is the only thing
   that makes the learning loop say anything.

## Rules

- **Open the site before a message makes a checkable claim about it.** The record
  is evidence, not proof. Signals have been measured on a 403 error body and
  stored as facts about a business's website.
- Say what was looked for, not what is true. "I couldn't find a website for you"
  is a fact about the search; "you don't have a website" is a claim about them,
  and they are the one person who knows the answer.
- Never claim a disqualified stack, invent a client, or imply he is local to a
  business he has never visited.
- The ladder is three messages and then it stops. `logContact` refuses a fourth.
- A decline suppresses the phone, email and domain — and 95 rows share a phone
  with another business, so it can reach further than one row. `undecline` exists
  and releases only what no other declined prospect owns.

## Report

Four lines:

- how many messages written, and how many `drafts:verify` refused
- how many sent, by channel
- follow-ups owed, and when the next rung falls due
- anything a person has to decide
