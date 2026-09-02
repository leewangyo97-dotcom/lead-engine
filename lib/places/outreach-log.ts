import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { outreach, prospects, suppressions } from "../db/schema";
import { rootDomain } from "./normalize";
import { chooseChannel, type Channel } from "./contact";

/**
 * Recording that a prospect was contacted, and refusing when they asked not to
 * be.
 *
 * Click-to-chat opens WhatsApp in another application, so nothing here can
 * confirm the message was actually sent — only that the link was opened. The
 * column is honest about that: `sentAt` is set on the click because opening a
 * pre-filled chat is as close to a send as this side can observe, and the
 * alternative, leaving it null, would make every follow-up query think nobody
 * has been contacted.
 */

/**
 * The step number of a message waiting for a person to approve it.
 *
 * Negative so it can never be mistaken for a touch that happened: the follow-up
 * sequence counts 0, 1, 2, and a draft is not a contact.
 */
export const DRAFT_STEP = -1;

export interface SuppressionHit {
  kind: string;
  value: string;
  reason: string | null;
}

/**
 * Whether a prospect is on the do-not-contact list.
 *
 * Keyed loosely on purpose: someone who declined by email should not then get a
 * WhatsApp message, and a second branch of the same company on the same domain
 * counts as the same "no".
 */
export async function findSuppression(prospectId: string): Promise<SuppressionHit | null> {
  const db = getDb();

  const [row] = await db
    .select({
      email: prospects.email,
      phoneE164: prospects.phoneE164,
      whatsappE164: prospects.whatsappE164,
      website: prospects.website,
      rootDomain: prospects.rootDomain,
    })
    .from(prospects)
    .where(eq(prospects.id, prospectId))
    .limit(1);
  if (!row) return null;

  const domain = row.rootDomain ?? (row.website ? rootDomain(row.website) : null);
  const values = [row.email, row.phoneE164, row.whatsappE164, domain]
    .filter((v): v is string => !!v)
    .map((v) => v.toLowerCase());
  if (values.length === 0) return null;

  const [hit] = await db
    .select({ kind: suppressions.kind, value: suppressions.value, reason: suppressions.reason })
    .from(suppressions)
    .where(inArray(suppressions.value, values))
    .limit(1);

  return hit ?? null;
}

export async function suppress(kind: string, value: string, reason?: string): Promise<void> {
  const db = getDb();
  await db
    .insert(suppressions)
    .values({ kind, value: value.toLowerCase(), reason })
    .onConflictDoNothing();
}

/**
 * Domains that belong to a hosting platform rather than to a business.
 *
 * Suppressing one of these would silently block every other business that
 * happens to use the same builder — a single "no" from one Weebly site taking
 * out every Weebly site in the country. Found by declining a real prospect and
 * reading what went on the list.
 */
const SHARED_DOMAINS = new Set([
  "weebly.com",
  "wixsite.com",
  "wix.com",
  "squarespace.com",
  "blogspot.com",
  "wordpress.com",
  "business.site",
  "google.com",
  "facebook.com",
  "sites.google.com",
  "myshopify.com",
  "webflow.io",
  "godaddysites.com",
  "netlify.app",
  "vercel.app",
  "github.io",
]);

export function isSharedHost(domain: string): boolean {
  return SHARED_DOMAINS.has(domain.toLowerCase());
}

export interface DeclineResult {
  ok: boolean;
  /** Which identifiers were suppressed, so the UI can say what it did. */
  suppressed: { kind: string; value: string }[];
  error?: string;
}

/**
 * Records that someone asked not to be contacted.
 *
 * Every identifier they own goes on the list, not just the one they replied on.
 * A person who says no by WhatsApp has said no to email as well, and a tool that
 * needs to be told twice is a tool that will contact them twice.
 *
 * The row itself is marked rather than deleted: deleting it means the next
 * search finds the same business, knows nothing, and offers it again.
 */
export async function decline(
  prospectId: string,
  reason?: string,
  now: () => Date = () => new Date(),
): Promise<DeclineResult> {
  const db = getDb();

  const [place] = await db.select().from(prospects).where(eq(prospects.id, prospectId)).limit(1);
  if (!place) return { ok: false, suppressed: [], error: "no such prospect" };

  const domain = place.rootDomain ?? (place.website ? rootDomain(place.website) : null);
  const entries = [
    place.email ? { kind: "email", value: place.email } : null,
    place.phoneE164 ? { kind: "phone", value: place.phoneE164 } : null,
    place.whatsappE164 ? { kind: "phone", value: place.whatsappE164 } : null,
    // A platform domain identifies the builder, not the business.
    domain && !isSharedHost(domain) ? { kind: "domain", value: domain } : null,
  ].filter((e): e is { kind: string; value: string } => e !== null);

  for (const entry of entries) {
    await suppress(entry.kind, entry.value, reason ?? "asked not to be contacted");
  }

  await db
    .update(prospects)
    .set({ status: "do_not_contact", updatedAt: now() })
    .where(eq(prospects.id, prospectId));

  return { ok: true, suppressed: entries };
}

export interface LogContactResult {
  ok: boolean;
  outreachId?: string;
  href?: string;
  /** Set when the contact was refused, for showing rather than throwing. */
  blocked?: string;
}

/**
 * Logs one outreach and returns the link to open.
 *
 * The link is built here rather than in the browser so that what is recorded and
 * what is opened are the same text. Building the message in two places is how
 * the log quietly stops describing what was actually sent.
 */
export async function logContact(
  prospectId: string,
  channel: Channel,
  now: () => Date = () => new Date(),
): Promise<LogContactResult> {
  const db = getDb();

  const [place] = await db.select().from(prospects).where(eq(prospects.id, prospectId)).limit(1);
  if (!place) return { ok: false, blocked: "no such prospect" };

  if (place.status === "do_not_contact") {
    return { ok: false, blocked: "marked do-not-contact" };
  }

  const hit = await findSuppression(prospectId);
  if (hit) {
    return {
      ok: false,
      blocked: `on the do-not-contact list (${hit.kind}${hit.reason ? `: ${hit.reason}` : ""})`,
    };
  }

  // An enhanced message that a person accepted wins over the generated one.
  // Ignoring it would mean the review step changed nothing, which is worse than
  // not offering the review at all.
  const [draft] = await db
    .select({ id: outreach.id, body: outreach.body, angle: outreach.angle })
    .from(outreach)
    .where(and(eq(outreach.prospectId, prospectId), eq(outreach.step, DRAFT_STEP)))
    .limit(1);

  const plan = chooseChannel(place, draft?.body);
  const option = channel === "whatsapp" ? plan.whatsapp : plan.email;
  if (!option.available || !option.href) {
    return { ok: false, blocked: option.reason ?? "channel unavailable" };
  }

  // Step counts what has already gone out, so the follow-up rules see a real
  // sequence rather than a pile of first touches.
  const previous = await db
    .select({ step: outreach.step })
    .from(outreach)
    .where(and(eq(outreach.prospectId, prospectId), gte(outreach.step, 0)))
    .orderBy(desc(outreach.step))
    .limit(1);
  const step = previous.length ? previous[0].step + 1 : 0;

  const [row] = await db
    .insert(outreach)
    .values({
      prospectId,
      channel,
      step,
      subject: channel === "whatsapp" ? `WhatsApp to ${place.name}` : `A quick idea for ${place.name}`,
      body: plan.message,
      sentAt: now(),
      angle: draft?.angle ?? (place.website ? "site-improvement" : "no-website"),
    })
    .returning({ id: outreach.id });

  // The draft has become a real message; leaving it would offer the same text
  // for review again after it was already sent.
  if (draft) await db.delete(outreach).where(eq(outreach.id, draft.id));

  await db
    .update(prospects)
    .set({ status: "contacted", updatedAt: now() })
    .where(eq(prospects.id, prospectId));

  return { ok: true, outreachId: row.id, href: option.href };
}

/** Prospect ids already contacted, so the table can say so without a join per row. */
export async function contactedIds(prospectIds: string[]): Promise<Set<string>> {
  if (prospectIds.length === 0) return new Set();
  const db = getDb();
  const rows = await db
    .select({ prospectId: outreach.prospectId })
    .from(outreach)
    .where(and(inArray(outreach.prospectId, prospectIds), gte(outreach.step, 0)));
  return new Set(rows.map((r) => r.prospectId).filter((id): id is string => id !== null));
}
