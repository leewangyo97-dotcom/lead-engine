import { and, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { getDb } from "./db";
import { leads, outreach, prospects } from "./db/schema";
import { getDueFollowups } from "./leads/followup-queries";

/**
 * What is waiting on Joshua, for the card at the top of the Inbox: the things
 * only a person can do, counted, each with where to do it.
 *
 * The machine runs every night by itself. On 15 Oct, 25 follow-ups were a
 * month overdue and no answer had ever been marked, and no screen said so in
 * one place: each lived on its own page, and nothing sent anyone there.
 */
export interface WaitingItem {
  key: string;
  /** 0 for a setup line, which is a state rather than a count. */
  count: number;
  text: string;
  href: string | null;
  action: string | null;
}

export interface WaitingCounts {
  followupsDue: number;
  awaitingAnswer: number;
  openedNotSent: number;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** The card's lines, most pressing first; nothing for anything at zero. */
export function waitingItems(counts: WaitingCounts, env: Record<string, string | undefined>): WaitingItem[] {
  const items: WaitingItem[] = [];
  if (counts.followupsDue > 0) {
    items.push({
      key: "followups",
      count: counts.followupsDue,
      text: `${plural(counts.followupsDue, "follow-up", "follow-ups")} due`,
      href: "/followups",
      action: "Start sweep",
    });
  }
  if (counts.openedNotSent > 0) {
    items.push({
      key: "unsent",
      count: counts.openedNotSent,
      text: `${plural(counts.openedNotSent, "email", "emails")} opened but never marked sent, so not counted and never followed up`,
      href: "/replies#unsent",
      action: "See them",
    });
  }
  if (counts.awaitingAnswer > 0) {
    items.push({
      key: "answers",
      count: counts.awaitingAnswer,
      text: `${plural(counts.awaitingAnswer, "message", "messages")} waiting for an answer: check, and mark any reply`,
      href: "/replies",
      action: "Check replies",
    });
  }
  // Presence only: a live check with Google is Settings' job, and this page
  // is the one opened most.
  if (!env.GOOGLE_REFRESH_TOKEN) {
    items.push({
      key: "gmail",
      count: 0,
      text: "Gmail is not connected here, so Email opens your mail app instead of making a draft",
      href: "/settings",
      action: "Settings",
    });
  }
  if (!env.GITHUB_DISPATCH_TOKEN) {
    items.push({
      key: "dispatch",
      count: 0,
      text: "GITHUB_DISPATCH_TOKEN is not set, so Enhance, Run now and Discover show terminal commands (README, Environment variables)",
      href: null,
      action: null,
    });
  }
  return items;
}

export async function waitingOnYou(env: Record<string, string | undefined> = process.env): Promise<WaitingItem[]> {
  const db = getDb();
  const [due, [businesses], [applications], [opened]] = await Promise.all([
    getDueFollowups(),
    // Messaged, marked sent, and not yet answered either way.
    db
      .select({ n: sql<number>`count(distinct ${outreach.prospectId})::int` })
      .from(outreach)
      .innerJoin(prospects, eq(prospects.id, outreach.prospectId))
      .where(and(isNotNull(outreach.sentAt), gte(outreach.step, 0), eq(prospects.status, "contacted"))),
    db.select({ n: sql<number>`count(*)::int` }).from(leads).where(eq(leads.status, "sent")),
    // Opened (a Gmail draft or the mail app) and never confirmed with "I sent it".
    db
      .select({ n: sql<number>`count(distinct ${outreach.prospectId})::int` })
      .from(outreach)
      .where(and(isNotNull(outreach.prospectId), isNull(outreach.sentAt), gte(outreach.step, 0))),
  ]);
  return waitingItems(
    {
      followupsDue: due.length,
      awaitingAnswer: Number(businesses.n) + Number(applications.n),
      openedNotSent: Number(opened.n),
    },
    env,
  );
}
