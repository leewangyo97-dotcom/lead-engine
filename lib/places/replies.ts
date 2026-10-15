import { and, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { getDb } from "../db";
import { leads, outreach, prospects } from "../db/schema";

/**
 * Everyone a message actually went to, and whether they answered: what
 * /replies lists.
 *
 * The app cannot see answers. Gmail is `gmail.compose` only, which cannot read
 * the mailbox, and WhatsApp has no API here. So a reply exists only when a
 * person marks it, and until 15 Oct marking one meant finding the business
 * among 23,000 prospects, because the /prospects queue lists only new ones.
 * Zero replies were logged, and /review can learn nothing from zeros.
 */
export interface MessagedProspect {
  id: string;
  name: string;
  category: string;
  city: string | null;
  /** contacted while waiting; replied, won or lost once answered. */
  status: string;
  firstSentAt: Date;
  lastSentAt: Date;
  /** Messages marked sent, first message and follow-ups together. */
  sends: number;
  channels: string[];
  /** Where the emails went: the recorded address, else the business's own. */
  email: string | null;
  /** The number a WhatsApp chat is with. */
  whatsapp: string | null;
}

export interface MessagedLead {
  id: string;
  company: string | null;
  title: string;
  status: string;
  lastSentAt: Date;
}

export const ANSWERED = ["replied", "won", "lost"];

export async function messagedProspects(): Promise<MessagedProspect[]> {
  const rows = await getDb()
    .select({
      id: prospects.id,
      name: prospects.name,
      category: prospects.category,
      city: prospects.city,
      status: prospects.status,
      businessEmail: prospects.email,
      whatsappE164: prospects.whatsappE164,
      phoneE164: prospects.phoneE164,
      firstSentAt: sql<string>`min(${outreach.sentAt})`,
      lastSentAt: sql<string>`max(${outreach.sentAt})`,
      sends: sql<number>`count(*)::int`,
      channels: sql<string[]>`array_agg(distinct ${outreach.channel})`,
      // The address the latest email went to (rows since 14 Oct record it).
      sentTo: sql<string | null>`(array_agg(${outreach.toAddress} order by ${outreach.sentAt} desc) filter (where ${outreach.channel} = 'email' and ${outreach.toAddress} is not null))[1]`,
    })
    .from(outreach)
    .innerJoin(prospects, eq(prospects.id, outreach.prospectId))
    // Sent, not merely drafted: an unconfirmed Gmail draft asks nobody anything.
    .where(and(isNotNull(outreach.sentAt), gte(outreach.step, 0)))
    .groupBy(prospects.id)
    // Oldest first: the longer a message has been out, the likelier an answer
    // is already sitting in the inbox unmarked.
    .orderBy(sql`max(${outreach.sentAt}) asc`);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    city: r.city,
    status: r.status,
    firstSentAt: new Date(r.firstSentAt),
    lastSentAt: new Date(r.lastSentAt),
    sends: Number(r.sends),
    channels: r.channels ?? [],
    email: r.channels?.includes("email") ? (r.sentTo ?? r.businessEmail) : null,
    whatsapp: r.channels?.includes("whatsapp") ? (r.whatsappE164 ?? r.phoneE164) : null,
  }));
}

/** Job leads an application went to. Their outcomes are the lead's status (app/actions.ts). */
export async function messagedLeads(): Promise<MessagedLead[]> {
  const rows = await getDb()
    .select({
      id: leads.id,
      company: leads.company,
      title: leads.title,
      status: leads.status,
      lastSentAt: sql<string>`max(${outreach.sentAt})`,
    })
    .from(outreach)
    .innerJoin(leads, eq(leads.id, outreach.leadId))
    .where(isNotNull(outreach.sentAt))
    .groupBy(leads.id)
    .orderBy(sql`max(${outreach.sentAt}) asc`);
  return rows.map((r) => ({ ...r, lastSentAt: new Date(r.lastSentAt) }));
}

export interface OpenedNotSent {
  id: string;
  name: string;
  channel: string;
  openedAt: Date;
  /** A Gmail draft exists: it waits in Drafts. Otherwise it went to the mail app. */
  inGmail: boolean;
}

/**
 * Messages opened, by a Gmail draft or the mail app, and never confirmed with
 * "I sent it". Each either went out and is not counted, or never went: the
 * row on /prospects says which once the button is pressed.
 */
export async function openedNotSent(): Promise<OpenedNotSent[]> {
  const rows = await getDb()
    .select({
      id: prospects.id,
      name: prospects.name,
      channel: outreach.channel,
      openedAt: outreach.createdAt,
      gmailDraftId: outreach.gmailDraftId,
    })
    .from(outreach)
    .innerJoin(prospects, eq(prospects.id, outreach.prospectId))
    .where(and(isNull(outreach.sentAt), gte(outreach.step, 0)))
    .orderBy(outreach.createdAt);
  // One line per business: the earliest unconfirmed message is the one waiting.
  const seen = new Set<string>();
  return rows
    .filter((r) => !seen.has(r.id) && !!seen.add(r.id))
    .map((r) => ({ id: r.id, name: r.name, channel: r.channel, openedAt: r.openedAt, inGmail: !!r.gmailDraftId }));
}

/**
 * Gmail's search for anything from that address, so "did they answer?" is
 * one click. The address sits in the fragment, which the browser never sends
 * to a server; Gmail reads it on the page.
 */
export function gmailSearchUrl(email: string): string {
  return `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(`from:${email.trim().toLowerCase()}`)}`;
}

/** The WhatsApp chat with that number, where an answer would be. */
export function whatsappChatUrl(e164: string): string {
  return `https://wa.me/${e164.replace(/\D/g, "")}`;
}

/** Whole days since a send, by the calendar in Manila, so "today" means today there. */
export function daysSince(sent: Date, now: Date = new Date()): number {
  const day = (d: Date) => Math.floor((d.getTime() + 8 * 3_600_000) / 86_400_000);
  return Math.max(0, day(now) - day(sent));
}
