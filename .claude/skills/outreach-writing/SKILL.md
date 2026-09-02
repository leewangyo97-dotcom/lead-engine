---
name: outreach-writing
description: Joshua's cold outreach voice, structure, proof-match table and hard rules. Use whenever drafting an email, follow-up, profile bio, or proposal in his name.
---

# Outreach writing

An email gets four seconds. It survives them by being specific about *them* in the
first line and specific about *him* in the second.

## Structure — five to seven lines, never more

```
1    Them: the trigger, the role, the exact thing in their post.
2-3  The matched proof: numbers and named products.
4    The obstacle, named honestly, if one exists.
5    One small ask.
     joshuasenining.dev
     Signature.
```

## Proof-match

Pick by signal. One proof, occasionally two. Never four.

| Signal | Lead with |
|---|---|
| React Native, mobile, Android, Kotlin | crash rate −35% + Jollibee/Landbank/JoyRide |
| DevOps, CI, release, build, Fastlane | 30 signed variants in ~5 min |
| legacy, rescue, inherit, refactor, tech debt | 3,000+ defects resolved |
| real-time, chat, video, sockets, calling | Tencent IM 3.x→4.x migration |
| cross-platform, iOS + Android, shared code | Kotlin Multiplatform adoption |
| consumer, scale, millions of users | the named shipped apps |
| agents, LLM, MCP, AI tooling, Cursor | custom Claude Code agents, skills, MCP servers |
| Next.js, TypeScript, full-stack web | Zoho Inventory, ThredUp, ShopGoodwill |

## Voice

**Plain, direct, unhurried.** Short sentences. Concrete nouns. No throat-clearing.

Write the way a competent person talks to another competent person they respect but
don't know. Not deferential, not salesy.

### Banned outright

"Passionate", "proven track record", "I'd love the opportunity", "reach out",
"leverage", "synergy", "rockstar", "ninja", "I hope this email finds you well",
"I came across your posting", any sentence starting "As a senior developer with".

### The portability test

If a sentence could be pasted into an email to a different company unchanged, it is
filler. Delete it. Apply this to every line before finishing.

## Subject lines

Specific, lowercase-ish, under 60 characters. It should read like a colleague's
subject line, not a job application.

- Good: `Senior React Native contractor, available now`
- Good: `Offline-first mobile — 7 yrs RN + Kotlin Multiplatform`
- Good: `Kotlin/Compose + Next.js — would you consider remote?`
- Bad: `Application for Senior Engineer Position`
- Bad: `Experienced Developer Seeking Opportunity`

## Name the obstacle first

If the role is US-only, onsite, or otherwise closed to him, say so in the email and
ask one direct question. Do not pretend not to have noticed.

> "I know the role is onsite in Astoria and I'm based in Manila, so I'll ask
> directly rather than waste your time: would you consider a remote contractor for
> any part of this? If not, understood."

This converts better than hedging, and it fails fast when it fails.

## The ask

Exactly one, and small:

- "Happy to do a small paid trial task if that's easier than an interview loop."
- "Would you consider a contractor outside North America?"
- "If there's a piece you'd rather have moving now, I'll take it on contract."

Never "let me know if you'd like to schedule a call at your convenience". That is
an ask that asks the reader to do the work.

## The two fields the learning loop reads

Every draft records an `angle` and the `proofUsed`. They are not bookkeeping:
`lib/review/rollup.ts` groups reply rates by angle, and needs five sends of the
same angle before it will report a rate at all. Free-text angles fragment that
into buckets of one, and the loop can never say anything.

Use these values exactly.

| `angle` | The email's opening move |
|---|---|
| `stack-exact` | their stack is his stack, named precisely |
| `offline-hard` | offline-first or sync is the hard part they mentioned |
| `tz-preempt` | names the timezone gap before they raise it |
| `trigger-fund` | they just raised or just launched |
| `paid-trial` | offers a small paid trial task instead of an interview loop |
| `ask-direct` | the role is closed to him; asks the direct question anyway |
| `bench-offer` | offers to take one piece off their plate on contract |

| `proofUsed` | Backed by |
|---|---|
| `crash-rate` | crash rate cut 35% |
| `defects` | 3,000+ defects resolved |
| `fastlane` | 30 signed variants in ~5 min |
| `tencent` | Tencent IM 3.x to 4.x migration |
| `kmp` | Kotlin/Compose Multiplatform adoption |
| `shipped-apps` | Jollibee, Landbank, JoyRide, GoodNovel |
| `ai-tooling` | custom Claude Code agents, skills, MCP servers |

One proof, occasionally two. Every one traces to `memory/PROFILE.md`; if a claim
is not in that file it does not go in the email.

## Hard rules

1. Every factual claim traces to `memory/PROFILE.md`. `verifier` enforces this.
2. Never claim a disqualified stack — not even "familiar with".
3. The AI work is **AI-assisted development**. Never imply ML research or training.
4. Always include `joshuasenining.dev` and the signature block.
5. Never contact the same company twice within 90 days.
6. Follow-ups: day 4 and day 11, then stop. Each references the original in one
   line and adds something new — never "just bumping this".

## Signature

```
—
Joshua Senining
Full Stack + Mobile Developer · Manila (UTC+8)
joshuasenining.dev · WhatsApp +63 915 858 7388
```
