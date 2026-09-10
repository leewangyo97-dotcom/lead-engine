import { sql } from "drizzle-orm";
import { getDb } from "../lib/db";
import { loadLocalEnv } from "../lib/env";
import { leads } from "../lib/db/schema";
import { headline, inert, projections, summarise } from "../lib/scoring/diagnose";
import {
  FUNDING_MAXIMA,
  JOB_MAXIMA,
  NEEDS_DRAFT_THRESHOLD,
  fromLead,
  prescore,
} from "../lib/scoring/prescore";

/**
 * Why the inbox is empty.
 *
 *   pnpm leads:diagnose
 *
 * A week of nightly runs harvested 48 leads and drafted none, and nothing in the
 * app could say whether that was a broken filter or an honest verdict on what
 * the sources carry. The two look identical from outside: an empty inbox either
 * way.
 *
 * This aggregates the score parts the lead page already computes one lead at a
 * time. It is deterministic and reads only what is already stored — no model, no
 * network — so it can be run whenever the funnel goes quiet.
 */
async function main() {
  loadLocalEnv();
  const db = getDb();

  const rows = await db.select().from(leads);
  if (!rows.length) {
    console.log("leads:diagnose: nothing harvested yet");
    return;
  }

  const funnel = await db.execute(sql`
    select
      count(*)::int as total,
      count(*) filter (where harvested_at >= now() - interval '7 days')::int as week,
      count(*) filter (where status = 'disqualified')::int as disqualified,
      count(*) filter (where status = 'parked')::int as parked,
      count(*) filter (where status in ('needs_scoring','scored','needs_draft'))::int as in_play,
      count(*) filter (where status in ('drafted','in_gmail','sent','answered'))::int as worked
    from leads
  `);
  const f = funnel.rows[0] as Record<string, number>;

  console.log(
    `leads: ${f.total} total, ${f.week} in the last 7 days — ` +
      `${f.disqualified} disqualified, ${f.parked} parked, ${f.in_play} still in play, ` +
      `${f.worked} drafted or beyond`,
  );

  for (const [kind, maxima] of [
    ["job", JOB_MAXIMA],
    ["funding", FUNDING_MAXIMA],
  ] as const) {
    const subset = rows.filter((r) => (kind === "funding" ? r.kind === "funding" : r.kind !== "funding"));
    if (!subset.length) continue;

    const parts = subset.map((r) => prescore(fromLead(r)).parts as unknown as Record<string, number>);
    const stats = summarise(parts, maxima);

    console.log(`\n${kind} leads (${subset.length})`);
    for (const s of stats) {
      console.log(
        `  ${s.key.padEnd(10)} ${s.average.toFixed(1).padStart(5)} / ${String(s.max).padStart(2)}` +
          `  ${s.share.toFixed(0).padStart(3)}% of max` +
          `  zero: ${String(s.zeros).padStart(4)}/${s.count}` +
          `  full: ${String(s.full).padStart(4)}`,
      );
    }
    console.log(`\n  ${headline(stats, NEEDS_DRAFT_THRESHOLD)}`);

    // What one perfect dimension would buy. Ranking by points lost says where
    // the points go; it does not say whether closing that hole is enough, and
    // on this data it is not.
    const projected = projections(parts, maxima, NEEDS_DRAFT_THRESHOLD);
    const enough = projected.filter((p) => p.clears);
    console.log(
      "\n  If one dimension were perfect: " +
        projected
          .slice(0, 3)
          .map((p) => `${p.key} ${p.projected.toFixed(0)}`)
          .join(", "),
    );
    console.log(
      enough.length
        ? `  ${enough.map((p) => p.key).join(" or ")} alone would clear ${NEEDS_DRAFT_THRESHOLD}.`
        : `  No single dimension reaches ${NEEDS_DRAFT_THRESHOLD} on its own — the constraint is ` +
          "not one thing, and no single source change fixes it.",
    );

    for (const dead of inert(stats)) {
      const how = dead.full === dead.count ? "full marks to every lead" : "nothing to any lead";
      console.log(
        `  Note: ${dead.key} awards ${how}, so it ranks nothing — a constant, not a weight.`,
      );
    }
  }

  console.log(
    "\nA large hole in one dimension is a supply finding, not a scoring bug: it says " +
      "what the sources carry. Loosening a weight to clear the threshold drafts leads " +
      "the rubric already judged badly.",
  );
}

main().catch((err) => {
  console.error("leads:diagnose:", err instanceof Error ? err.message : err);
  process.exit(1);
});
