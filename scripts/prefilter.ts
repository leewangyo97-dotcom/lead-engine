import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "../lib/db";
import { loadLocalEnv } from "../lib/env";
import { events, leads, outreach, scores } from "../lib/db/schema";
import { CONTACT_COOLDOWN_DAYS, disqualify, fromLead as toDisqualifyInput } from "../lib/scoring/disqualify";
import { NEEDS_DRAFT_THRESHOLD, RUBRIC_VERSION, fromLead as toPrescoreInput, prescore } from "../lib/scoring/prescore";

/**
 * Stage 2 adjusts by at most +/-15, so nothing below this can reach the
 * needs_draft threshold of 75 no matter how well it reads. Sending it to a model
 * is spending tokens on a foregone conclusion.
 */
const MODEL_MAX_ADJUSTMENT = 15;
const PRESCORE_GATE = NEEDS_DRAFT_THRESHOLD - MODEL_MAX_ADJUSTMENT;

/**
 * A hard cap on stage-2 volume. Stage-2 cost scales with this number and nothing
 * else, so it is a number and not a hope — if a good day produces 60 candidates,
 * the best 25 go and the rest park, rather than the bill tripling silently.
 */
const MAX_TO_SCORE = 25;

async function main() {
  loadLocalEnv();
  const db = getDb();
  const now = new Date();

  const pending = await db.select().from(leads).where(eq(leads.status, "harvested"));
  if (!pending.length) {
    console.log("prefilter: nothing to do");
    return;
  }

  // One query for the whole contact-cooldown check, not one per lead.
  const cooldownStart = new Date(now.getTime() - CONTACT_COOLDOWN_DAYS * 86_400_000);
  const contacted = await db
    .select({ company: leads.company, at: outreach.createdAt })
    .from(outreach)
    .innerJoin(leads, eq(outreach.leadId, leads.id))
    .where(gte(outreach.createdAt, cooldownStart));

  const lastContacted = new Map<string, Date>();
  for (const row of contacted) {
    const key = row.company.toLowerCase();
    const prev = lastContacted.get(key);
    if (!prev || row.at > prev) lastContacted.set(key, row.at);
  }

  // The rule that rejected a lead, not just the fact that something did.
  // Without it the only answer to "why did nothing qualify tonight?" is to
  // re-run the filter by hand and watch.
  const rejected: { id: string; reason: string }[] = [];
  const survivors: { id: string; score: number; tier: string }[] = [];

  for (const lead of pending) {
    const reason = disqualify(
      toDisqualifyInput(lead, lastContacted.get(lead.company.toLowerCase()) ?? null),
      now,
    );
    if (reason) {
      rejected.push({ id: lead.id, reason });
      continue;
    }

    const result = prescore(toPrescoreInput(lead), now);
    survivors.push({ id: lead.id, score: result.score, tier: result.tier });
  }

  // Every survivor gets a score row — the parked ones too, so the learning loop
  // can later ask what the gate turned away.
  if (survivors.length) {
    await db.insert(scores).values(
      survivors.map((s) => ({
        leadId: s.id,
        preScore: s.score,
        tier: s.tier,
        rubricVer: RUBRIC_VERSION,
      })),
    );
  }

  const ranked = [...survivors].sort((a, b) => b.score - a.score);
  const promoted = ranked.filter((s) => s.score >= PRESCORE_GATE).slice(0, MAX_TO_SCORE);
  const promotedIds = new Set(promoted.map((p) => p.id));
  const parked = ranked.filter((s) => !promotedIds.has(s.id));

  if (rejected.length) {
    await db
      .update(leads)
      .set({ status: "disqualified" })
      .where(inArray(leads.id, rejected.map((r) => r.id)));

    await db.insert(events).values(
      rejected.map((r) => ({
        leadId: r.id,
        type: "disqualified",
        meta: { reason: r.reason, by: "prefilter" },
      })),
    );
  }
  if (promoted.length) {
    await db
      .update(leads)
      .set({ status: "needs_scoring" })
      .where(inArray(leads.id, [...promotedIds]));
  }
  if (parked.length) {
    await db
      .update(leads)
      .set({ status: "parked" })
      .where(inArray(leads.id, parked.map((p) => p.id)));
  }

  const overflow = ranked.filter((s) => s.score >= PRESCORE_GATE).length - promoted.length;
  console.log(
    `prefilter: seen=${pending.length} disqualified=${rejected.length} parked=${parked.length} needs_scoring=${promoted.length}` +
      (overflow > 0 ? ` (capped, ${overflow} above the gate parked)` : ""),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
