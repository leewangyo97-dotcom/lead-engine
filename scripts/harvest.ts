import { sql } from "drizzle-orm";
import { getDb } from "../lib/db";
import { loadLocalEnv } from "../lib/env";
import { leads, runMetrics, sources } from "../lib/db/schema";
import { adapters } from "../lib/sources";
import { contentHash } from "../lib/sources/hash";
import { overlapHours } from "../lib/sources/overlap";
import type { NormalisedLead } from "../lib/sources/types";
import { MAX_AGE_DAYS } from "../lib/scoring/disqualify";

/**
 * One window, not two. This used to be 21 while the disqualifier accepted 45,
 * so harvest quietly dropped rows the filter would have kept — a narrower funnel
 * than anyone had chosen, invisible because both numbers looked deliberate.
 */
const LOOKBACK_DAYS = MAX_AGE_DAYS;

function toRow(sourceId: string, lead: NormalisedLead) {
  return {
    sourceId,
    kind: lead.kind,
    contentHash: contentHash(lead),
    externalId: lead.externalId,
    company: lead.company,
    title: lead.title,
    region: lead.region,
    remoteScope: lead.remoteScope,
    isContract: lead.isContract,
    contact: lead.contact,
    isDirect: lead.isDirect,
    url: lead.url,
    payRaw: lead.payRaw,
    payMinUsdHr: lead.payMinUsdHr,
    stack: lead.stack,
    summary: lead.summary,
    triggerEvent: lead.triggerEvent,
    overlapHours: overlapHours(lead.remoteScope),
    postedAt: lead.postedAt,
  };
}

async function main() {
  loadLocalEnv();
  const startedAt = Date.now();
  const db = getDb();
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  let rawCount = 0;
  const rows: ReturnType<typeof toRow>[] = [];

  for (const adapter of adapters) {
    await db
      .insert(sources)
      .values({ id: adapter.id, label: adapter.label })
      .onConflictDoNothing();

    let sourceRaw = 0;
    try {
      const raw = await adapter.fetch(since);
      rawCount += raw.length;
      sourceRaw = raw.length;

      for (const item of raw) {
        // normalise never throws by contract, but one adapter bug must not end
        // the run for every other source either.
        const lead = adapter.normalise(item);
        if (lead) rows.push(toRow(adapter.id, lead));
      }

      await db
        .update(sources)
        .set({ lastRunAt: new Date(), lastOk: true, lastError: null, lastRawCount: sourceRaw })
        .where(sql`${sources.id} = ${adapter.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${adapter.id}] fetch failed: ${message}`);
      await db
        .update(sources)
        .set({
          lastRunAt: new Date(),
          lastOk: false,
          lastError: message.slice(0, 500),
          lastRawCount: sourceRaw,
        })
        .where(sql`${sources.id} = ${adapter.id}`);
    }
  }

  // Dedupe within the batch before touching the database: the same posting can
  // legitimately appear twice in one fetch, and a batch insert with two
  // identical conflict targets is a Postgres error, not a no-op.
  const byHash = new Map(rows.map((r) => [r.contentHash, r]));
  const unique = [...byHash.values()];

  let inserted = 0;
  if (unique.length) {
    const result = await db
      .insert(leads)
      .values(unique)
      // Nothing is updated on conflict. A row that already exists has already
      // been filtered, scored, maybe drafted — rewriting it would reset that
      // work, and the hash is stable precisely so this branch is the common one.
      .onConflictDoNothing({ target: leads.contentHash })
      .returning({ id: leads.id });
    inserted = result.length;
  }

  // Stages, per the funnel in docs/05-TOKEN-BUDGET.md: raw items fetched, then
  // what survived the content hash. `afterHash` is what is NEW — the whole point
  // of the hash is that most of a night exits here, and recording the deduped
  // total instead hid that saving completely. afterFilter belongs to prefilter,
  // which is the stage that applies the filters.
  await db.insert(runMetrics).values({
    rawCount,
    afterHash: inserted,
    afterFilter: 0,
    scoredCount: 0,
    draftedCount: 0,
    durationMs: Date.now() - startedAt,
  });

  console.log(
    `harvest: raw=${rawCount} normalised=${rows.length} unique=${unique.length} inserted=${inserted} skipped=${unique.length - inserted}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
