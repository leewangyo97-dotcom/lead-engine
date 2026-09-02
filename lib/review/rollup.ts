import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { events, leads, outreach, prospects } from "../db/schema";
import { REPLIED_TYPES } from "../followups";

/**
 * The weekly rollup, and the one feature that compounds.
 *
 * Everything here is counted, never estimated. A suggestion the tool cannot
 * point at evidence for is worse than no suggestion — it launders a guess as a
 * measurement, and the whole value of this loop is that it does not do that.
 */
export interface Cut {
  key: string;
  sends: number;
  replies: number;
  /** null below MIN_SENDS: a rate over three sends is noise wearing a number. */
  replyRate: number | null;
}

/**
 * Below this, a cut is reported but its rate is withheld. Two replies in three
 * sends is 67%, and it means nothing.
 */
export const MIN_SENDS = 5;

/** Enough total outcomes for any suggestion to be worth making at all. */
export const MIN_TOTAL_FOR_SUGGESTION = 20;

function toCut(key: string, sends: number, replies: number): Cut {
  return { key, sends, replies, replyRate: sends >= MIN_SENDS ? replies / sends : null };
}

export interface Rollup {
  totalSends: number;
  totalReplies: number;
  byAngle: Cut[];
  bySource: Cut[];
  byStack: Cut[];
  bySendDay: Cut[];
  suggestion: string | null;
}

export async function buildRollup(since?: Date): Promise<Rollup> {
  const db = getDb();

  const sent = await db
    .select({
      // Inner joined to leads, so present; nullable in the schema only because
      // an outreach row may belong to a geo prospect instead.
      leadId: sql<string>`${outreach.leadId}`,
      angle: outreach.angle,
      sentAt: outreach.sentAt,
      sourceId: leads.sourceId,
      stack: leads.stack,
    })
    .from(outreach)
    .innerJoin(leads, eq(leads.id, outreach.leadId))
    .where(
      since
        ? and(sql`${outreach.sentAt} is not null`, gte(outreach.sentAt, since))
        : sql`${outreach.sentAt} is not null`,
    );

  const replied = await db
    .select({ leadId: events.leadId })
    .from(events)
    .where(inArray(events.type, [...REPLIED_TYPES]));

  const repliedLeads = new Set(replied.map((r) => r.leadId).filter(Boolean) as string[]);

  const tally = new Map<string, Map<string, { sends: number; replies: number }>>();
  const bump = (dimension: string, key: string, isReply: boolean) => {
    if (!key) return;
    const dim = tally.get(dimension) ?? new Map();
    const cell = dim.get(key) ?? { sends: 0, replies: 0 };
    cell.sends += 1;
    if (isReply) cell.replies += 1;
    dim.set(key, cell);
    tally.set(dimension, dim);
  };

  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  for (const row of sent) {
    const isReply = repliedLeads.has(row.leadId);
    bump("angle", row.angle ?? "unrecorded", isReply);
    bump("source", row.sourceId, isReply);
    if (row.sentAt) bump("day", DAYS[new Date(row.sentAt).getUTCDay()], isReply);
    // A send counts once per stack token, so a lead can appear in several rows.
    // The denominators are per-token, which is what "does Kotlin work" asks.
    for (const token of row.stack ?? []) bump("stack", token, isReply);
  }

  // Prospect outreach counts too. Leaving it out meant "what works" was answered
  // from job applications alone while half the messages went to businesses, and
  // the angles differ completely between the two.
  const prospectSends = await prospectRollupRows(since);
  for (const row of prospectSends) {
    bump("angle", row.angle ?? "unrecorded", row.replied);
    bump("source", row.source, row.replied);
    if (row.sentAt) bump("day", DAYS[new Date(row.sentAt).getUTCDay()], row.replied);
    bump("stack", row.category, row.replied);
  }

  const cutsFor = (dimension: string): Cut[] =>
    [...(tally.get(dimension) ?? new Map()).entries()]
      .map(([key, v]) => toCut(key, v.sends, v.replies))
      .sort((a, b) => b.sends - a.sends);

  const totalSends = sent.length + prospectSends.length;
  const totalReplies =
    sent.filter((s) => repliedLeads.has(s.leadId)).length +
    prospectSends.filter((p) => p.replied).length;

  return {
    totalSends,
    totalReplies,
    byAngle: cutsFor("angle"),
    bySource: cutsFor("source"),
    byStack: cutsFor("stack"),
    bySendDay: cutsFor("day"),
    suggestion: proposeChange(cutsFor("angle"), totalSends),
  };
}

/**
 * Proposes at most one rubric change, and only when the evidence is real.
 *
 * Never auto-applied. The output is a sentence for a human to accept or dismiss,
 * and accepting is what writes to memory/DECISIONS.md — see docs/06-FEATURES.md.
 */
export function proposeChange(byAngle: Cut[], totalSends: number): string | null {
  if (totalSends < MIN_TOTAL_FOR_SUGGESTION) {
    return null; // not enough outcomes for any claim to survive scrutiny
  }

  const eligible = byAngle.filter((c) => c.replyRate != null);
  if (eligible.length < 2) return null;

  const sorted = [...eligible].sort((a, b) => b.replyRate! - a.replyRate!);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];

  if (top.key === bottom.key) return null;
  // A gap this small is not a finding, it is two small samples disagreeing.
  if (top.replyRate! - bottom.replyRate! < 0.15) return null;

  return (
    `Angle "${top.key}" replied ${top.replies}/${top.sends}; "${bottom.key}" replied ` +
    `${bottom.replies}/${bottom.sends}. Consider leading with "${top.key}" more often. ` +
    `Accept to log this in DECISIONS.md — nothing is applied automatically.`
  );
}

/**
 * Prospect sends, shaped like lead sends so one tally can hold both.
 *
 * "Replied" is read from the prospect's own status, because nothing else
 * records it: a won or lost outcome is still a reply for the purposes of asking
 * whether an angle got an answer.
 */
async function prospectRollupRows(since?: Date) {
  const db = getDb();

  const rows = await db
    .select({
      angle: outreach.angle,
      sentAt: outreach.sentAt,
      channel: outreach.channel,
      category: prospects.category,
      status: prospects.status,
    })
    .from(outreach)
    .innerJoin(prospects, eq(prospects.id, outreach.prospectId))
    .where(
      since
        ? and(sql`${outreach.sentAt} is not null`, gte(outreach.sentAt, since))
        : sql`${outreach.sentAt} is not null`,
    );

  return rows.map((r) => ({
    angle: r.angle,
    sentAt: r.sentAt,
    category: r.category,
    source: `prospects:${r.channel}`,
    replied: r.status === "replied" || r.status === "won" || r.status === "lost",
  }));
}