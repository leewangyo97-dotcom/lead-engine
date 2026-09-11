import { and, desc, eq, gte, inArray, isNull, isNotNull, ne } from "drizzle-orm";
import { getDb } from "../db";
import { outreach, prospects, suppressions } from "../db/schema";
import { rootDomain } from "./normalize";
import { chooseChannel, type Channel } from "./contact";
import { messageFor } from "./follow-up-message";
import { MAX_STEP } from "../followups";
import { keyOf, releasable, type Identifier } from "./undecline";
import { createDraft, getAccessToken, readCredentials } from "../gmail/client";
import { cleanEmail } from "../sources/email";

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
/**
 * Everything a decline puts on the list for one prospect.
 *
 * Shared by `decline` and `undecline` so the two cannot disagree about what a
 * refusal covers — an undo that derived this list differently would leave
 * entries behind or take back ones it never wrote.
 */
type PlaceRow = typeof prospects.$inferSelect;

export function identifiersOf(place: PlaceRow): Identifier[] {
  const domain = place.rootDomain ?? (place.website ? rootDomain(place.website) : null);
  return [
    place.email ? ({ kind: "email", value: place.email } as const) : null,
    place.phoneE164 ? ({ kind: "phone", value: place.phoneE164 } as const) : null,
    place.whatsappE164 ? ({ kind: "phone", value: place.whatsappE164 } as const) : null,
    // A platform domain identifies the builder, not the business.
    domain && !isSharedHost(domain) ? ({ kind: "domain", value: domain } as const) : null,
  ].filter((e): e is Identifier => e !== null);
}

export async function decline(
  prospectId: string,
  reason?: string,
  now: () => Date = () => new Date(),
): Promise<DeclineResult> {
  const db = getDb();

  const [place] = await db.select().from(prospects).where(eq(prospects.id, prospectId)).limit(1);
  if (!place) return { ok: false, suppressed: [], error: "no such prospect" };

  const entries = identifiersOf(place);

  for (const entry of entries) {
    await suppress(entry.kind, entry.value, reason ?? "asked not to be contacted");
  }

  await db
    .update(prospects)
    .set({ status: "do_not_contact", updatedAt: now() })
    .where(eq(prospects.id, prospectId));

  return { ok: true, suppressed: entries };
}

export interface UndeclineResult {
  ok: boolean;
  /** Entries actually taken off the list. */
  released: Identifier[];
  /** Entries kept because another declined prospect owns them too. */
  kept: Identifier[];
  error?: string;
}

/**
 * Takes a prospect off the do-not-contact list.
 *
 * Declining is one click behind one confirmation, and until now it was the only
 * one-way door in the app: nothing in the UI could undo it, and the entries it
 * writes are keyed on the value rather than the prospect, so even by hand it was
 * not obvious what to delete.
 *
 * An identifier shared with another still-declined prospect stays on the list.
 * See `releasable` — a council switchboard released because one preschool was
 * undone would let the eleven that genuinely refused back into the queue.
 */
export async function undecline(
  prospectId: string,
  now: () => Date = () => new Date(),
): Promise<UndeclineResult> {
  const db = getDb();

  const [place] = await db.select().from(prospects).where(eq(prospects.id, prospectId)).limit(1);
  if (!place) return { ok: false, released: [], kept: [], error: "no such prospect" };

  const mine = identifiersOf(place);

  const others = await db
    .select()
    .from(prospects)
    .where(and(eq(prospects.status, "do_not_contact"), ne(prospects.id, prospectId)));

  const heldByOthers = others.flatMap(identifiersOf);
  const release = releasable(mine, heldByOthers);
  const heldKeys = new Set(release.map(keyOf));
  const kept = mine.filter((entry) => !heldKeys.has(keyOf(entry)));

  for (const entry of release) {
    await db
      .delete(suppressions)
      .where(
        and(eq(suppressions.kind, entry.kind), eq(suppressions.value, entry.value.toLowerCase())),
      );
  }

  await db
    .update(prospects)
    .set({ status: "new", updatedAt: now() })
    .where(eq(prospects.id, prospectId));

  return { ok: true, released: release, kept };
}

/**
 * What a click means, once it is known whether Gmail took the message.
 *
 * Pulled out of `logContact` because it is the rule this whole change exists
 * for and it was previously a conditional buried in an insert. A draft sitting
 * in an account is not a sent message: the row must carry no `sentAt`, or the
 * prospect drops out of the queue and comes due for a follow-up referring to
 * something they never received. Everything else is sent at the moment of the
 * click, because a person is about to press the button and nothing here will
 * ever see that happen.
 */
export function contactOutcome(
  channel: Channel,
  draftedInGmail: boolean,
): { mode: "gmail-draft" | "mailto" | "whatsapp"; countsAsSent: boolean } {
  if (channel === "whatsapp") return { mode: "whatsapp", countsAsSent: true };
  // Neither email path records a send. The mailto: one used to, on the grounds
  // that nothing here would ever observe it — but that reasoning made the
  // fallback a back door to exactly the bug the Gmail path was built to close.
  // The token expires weekly while the consent screen is in Testing, so the
  // fallback is not an edge case; it is next week.
  return { mode: draftedInGmail ? "gmail-draft" : "mailto", countsAsSent: false };
}

export interface LogContactResult {
  ok: boolean;
  outreachId?: string;
  href?: string;
  /** The same message reopened rather than a new one logged. */
  reopened?: boolean;
  /** Set when the contact was refused, for showing rather than throwing. */
  blocked?: string;
  /**
   * How the email actually left, which decides what the row means.
   *
   * `gmail-draft` — a real draft exists in the account and nothing is sent, so
   * `sentAt` stays null and the follow-up ladder does not start.
   * `mailto` — the browser was handed a link and a person will send it by hand,
   * which is the only moment this system can call a thing sent.
   */
  mode?: "gmail-draft" | "mailto" | "whatsapp";
  gmailDraftId?: string;
  /** Why the Gmail path was not used, said plainly rather than swallowed. */
  gmailError?: string;
}

/**
 * How long a click counts as reopening the last message rather than sending the
 * next one.
 *
 * A day: long enough to cover clicking twice, closing WhatsApp and coming back,
 * or a mail client that failed to open the first time; short enough that a
 * genuine follow-up tomorrow is a new rung. The ladder's own rungs are four and
 * eleven days out, so nothing legitimate lands inside this window.
 */
export const REOPEN_WINDOW_MS = 24 * 60 * 60 * 1000;

export function withinReopenWindow(sentAt: Date | null, now: Date): boolean {
  if (!sentAt) return true;
  return now.getTime() - sentAt.getTime() < REOPEN_WINDOW_MS;
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

  // Step counts what has already gone out, so the follow-up rules see a real
  // sequence rather than a pile of first touches.
  const [previous] = await db
    .select({ step: outreach.step, sentAt: outreach.sentAt })
    .from(outreach)
    .where(and(eq(outreach.prospectId, prospectId), gte(outreach.step, 0)))
    .orderBy(desc(outreach.step))
    .limit(1);

  // Clicking again reopens the same message; it does not send a new one.
  //
  // Every click used to insert a row and bump the step, so three clicks on one
  // clinic wrote steps 0, 1 and 2 — the whole ladder spent on a single message,
  // and three sends counted where one was made. WhatsApp and email both hand off
  // to another application, so a click is a request to open, not evidence of a
  // second conversation.
  const reopening = Boolean(previous && withinReopenWindow(previous.sentAt, now()));

  // Reopening shows the message that was already sent, so it keeps the previous
  // step rather than advancing to one nobody has seen.
  const step = reopening ? previous!.step : previous ? previous.step + 1 : 0;

  // Three touches is the ladder. A fourth is pestering, and it would arrive here
  // as step 3, which no follow-up rule knows what to do with.
  if (!reopening && step > MAX_STEP) {
    return {
      ok: false,
      blocked: `the ${MAX_STEP + 1}-message sequence is finished for this prospect`,
    };
  }

  // The message depends on where in the sequence this is, which is why the plan
  // is built after the step and not before.
  //
  // Every message used to come from `firstMessage` or the accepted draft,
  // whatever the step — so a prospect reaching day four would have received
  // their opening message again, word for word, from someone they had already
  // ignored once. Sixteen of those came due on 13 September.
  const body = messageFor({
    step,
    draftBody: draft?.body,
    name: place.name,
    category: place.category,
    hasWebsite: Boolean(place.website),
  });

  const plan = chooseChannel(place, body);
  const option = channel === "whatsapp" ? plan.whatsapp : plan.email;
  if (!option.available || !option.href) {
    return { ok: false, blocked: option.reason ?? "channel unavailable" };
  }

  if (reopening) {
    return { ok: true, outreachId: undefined, href: option.href, reopened: true };
  }

  const subject =
    channel === "whatsapp" ? `WhatsApp to ${place.name}` : `A quick idea for ${place.name}`;

  /*
   * Email goes through the Gmail API, and only falls back to a mailto: link.
   *
   * The button used to hand the browser a mailto: and record the row as sent in
   * the same breath. Two things were wrong with that. The browser reports
   * nothing when no mail client is registered, so the message could silently
   * never be written at all; and `sentAt` was stamped on a click, so a prospect
   * whose compose window was closed unsent still dropped out of the queue and
   * came due for a follow-up referring to a message they never received.
   *
   * A draft in the account is a fact this system can check. Sending remains a
   * person's act in Gmail — CLAUDE.md rule 2 — so `sentAt` stays null until
   * `markProspectSent` records that it happened.
   */
  let gmail: { id?: string; error?: string } = {};
  if (channel === "email" && place.email) {
    try {
      const token = await getAccessToken(readCredentials());
      gmail.id = await createDraft(token, {
        to: cleanEmail(place.email) ?? place.email,
        subject,
        body: plan.message,
      });
    } catch (err) {
      // Expected roughly weekly: the consent screen is in Testing, so Google
      // expires the refresh token every seven days. Falling back beats failing.
      gmail.error = err instanceof Error ? err.message : String(err);
    }
  }

  const outcome = contactOutcome(channel, Boolean(gmail.id));

  const [row] = await db
    .insert(outreach)
    .values({
      prospectId,
      channel,
      step,
      subject,
      body: plan.message,
      // A draft is not a send. Everything else still is, because a person is
      // about to press the button themselves and nothing here will see it.
      sentAt: outcome.countsAsSent ? now() : null,
      gmailDraftId: gmail.id ?? null,
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

  return {
    ok: true,
    outreachId: row.id,
    href: option.href,
    mode: outcome.mode,
    gmailDraftId: gmail.id,
    gmailError: gmail.error,
  };
}

/**
 * Records that an email actually went out.
 *
 * The one thing this system cannot observe, by either route. Gmail will not tell
 * us without a read scope the app deliberately does not hold — `gmail.compose`
 * creates drafts and can see nothing else — and a `mailto:` link vanishes into
 * whatever handles it. So a person says so, and the ladder starts from that
 * moment rather than from the click.
 *
 * Matched on an unsent row rather than on a draft id, so it covers both paths. A
 * WhatsApp row can never match: those are recorded sent at the click, because
 * wa.me opens a page that is unambiguously the message, and there is no draft
 * step in between to have failed.
 */
export async function markProspectSent(
  prospectId: string,
  now: () => Date = () => new Date(),
): Promise<{ ok: boolean; outreachId?: string; error?: string }> {
  const db = getDb();

  const [row] = await db
    .select({ id: outreach.id })
    .from(outreach)
    /*
     * `step >= 0` is load-bearing, not tidiness.
     *
     * The seventeen enhanced messages waiting for review are prospect outreach
     * rows at `DRAFT_STEP` (-1) with a null `sentAt` — indistinguishable from a
     * pending confirmation on those two columns alone. Matching on them marked
     * "Enhanced message for Otaku-Yaki Restaurant" as sent, a message nobody had
     * opened. Caught by calling the endpoint expecting a refusal and getting an
     * id back.
     */
    .where(
      and(
        eq(outreach.prospectId, prospectId),
        isNull(outreach.sentAt),
        gte(outreach.step, 0),
      ),
    )
    .orderBy(desc(outreach.createdAt))
    .limit(1);

  if (!row) return { ok: false, error: "nothing awaiting confirmation for this prospect" };

  await db.update(outreach).set({ sentAt: now() }).where(eq(outreach.id, row.id));
  return { ok: true, outreachId: row.id };
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
