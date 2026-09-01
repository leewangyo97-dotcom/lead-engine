---
name: source-adapter
description: The contract every lead source implements, and how to add one. Use when adding a job board, funding wire, or any new lead source, or when an adapter breaks.
---

# Source adapter contract

An adapter is the only code that knows about a specific website. Everything
downstream sees `NormalisedLead` and nothing else. That boundary is what makes
adding a source a one-file change and a site redesign a one-file breakage.

## Interface

```ts
export interface SourceAdapter {
  id: string                                    // matches sources.id, e.g. 'remoteok'
  label: string
  fetch(since: Date): Promise<RawItem[]>        // network only, no parsing
  normalise(raw: RawItem): NormalisedLead | null // pure, no network, never throws
}

export interface NormalisedLead {
  externalId?: string
  kind: 'job' | 'funding' | 'cofounder'
  company: string
  title: string
  region?: string          // verbatim from the posting
  remoteScope?: 'worldwide' | 'apac' | 'emea' | 'us' | 'onsite'
  isContract: boolean
  contact?: string         // email if the posting gives one
  isDirect: boolean        // personal inbox, not an ATS or role alias
  url?: string
  payRaw?: string
  payMinUsdHr?: number     // only when derivable; do not guess
  stack: string[]          // normalised lowercase tokens
  summary?: string         // TRUNCATED to 400 chars HERE, at ingest
  triggerEvent?: string    // 'raised $10M seed 6d ago'
  postedAt?: Date
}
```

## Rules

1. **`fetch` does network. `normalise` is pure.** Never mix them — pure
   normalisation is what makes fixture-based tests possible.
2. **`normalise` returns `null` for unparseable input. It never throws.** One bad
   record must not end the run.
3. **Truncate `summary` to 400 characters here.** Not downstream, not at read time.
   Making it structural is the point.
4. **Never include volatile data in anything that feeds `contentHash`** —
   timestamps, view counts, ranks, list positions. Unstable hashes silently destroy
   the dedupe that saves ~85% of nightly cost.
5. **`isDirect` means a human's inbox.** `dave@evanlee.co.uk` is direct.
   `jobs@company.com` is not. `jobs.ashbyhq.com/...` is not.
6. **Normalise stack tokens to lowercase, singular, canonical:** `react-native`,
   not `React Native` / `RN` / `react native`. Keep the map in `lib/sources/stack-map.ts`.
7. **Public sources only.** Nothing behind a login. Decision 006.
8. `User-Agent` set, `robots.txt` respected, one request per second.
9. **Never call `fetch` directly.** Use `fetchJson` from `lib/sources/fetch-json.ts`:
   it times out at 15s and retries 5xx, 429 and network errors three times with
   backoff. A stalled source otherwise holds the nightly job until GitHub kills
   it at 15 minutes, taking every adapter behind it. Algolia returns intermittent
   500s on individual pages — skip the page and carry on rather than aborting the
   source, and say so in the log.

## Required tests

Every adapter ships with `lib/sources/<id>.test.ts` covering:

```ts
it('normalises a real fixture into a valid NormalisedLead')
it('produces a stable contentHash across two runs')   // ← the important one
it('returns null for malformed input instead of throwing')
it('truncates summary to 400 chars')
it('detects isDirect correctly for personal vs ATS contacts')
```

Fixtures are trimmed **real** responses in `lib/sources/__fixtures__/<id>.json`,
not hand-written objects. Hand-written fixtures test your imagination.

## Adding one

`/new-source <url>` runs the `harvester` agent through: fetch a sample, save the
fixture, write the adapter, write the tests, register it, run one live harvest,
report the row count.

## Current adapters

| id | source | notes |
|---|---|---|
| `hn-whoishiring` | HN via Algolia API | Algolia **ANDs** multi-word queries — issue one single-term query at a time, then merge |
| `remoteok` | remoteok.com/api | Large JSON array; filter to engineering before normalising |
| `launch-hn` | HN "Launch HN" stories via Algolia | `kind: 'funding'` — a founder who has just raised. No stated region or terms, so `triggerEvent` and the contact carry the value. Scored on the founder weights, not the job ones |

## Candidates, not yet built

Wellfound RSS, Product Hunt launches, YC company directory, Indie Hackers.

**Measure before building.** A source survey (see `memory/DECISIONS.md`) killed
three candidates on evidence: HN's "Freelancer? Seeking freelancer?" thread
carries roughly one client post per four months, WeWorkRemotely's programming
feed had zero contract and zero mobile roles in 25 items, and both sites'
contract-only feeds now 404. Four API calls each, no adapter written.

Run `pnpm audit:titles` after adding a source — a new feed brings a new
vocabulary of job titles, and a "Senior Product Manager" once reached the inbox
at 67 on remote-contract-$96/hr terms because nothing in the list matched it.
