import { cleanEmail } from "../lib/sources/email";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { getDb } from "../lib/db";
import { loadLocalEnv } from "../lib/env";
import { events, leads, outreach } from "../lib/db/schema";
import { createDraft, getAccessToken, readCredentials } from "../lib/gmail/client";

/**
 * The only path from this system into Gmail.
 *
 * The verified-only rule is enforced in the WHERE clause, not in a branch — an
 * unverified row is never fetched, so no later edit to this file can accidentally
 * let one through. `docs/04-UI-SPEC.md` asks for the same thing in SQL for the
 * same reason.
 *
 * Drafts only. There is no send path anywhere in this repo.
 */
async function main() {
  loadLocalEnv();
  const db = getDb();

  const ready = await db
    .select({
      outreachId: outreach.id,
      // Inner joined to leads below, so always present. outreach.leadId is
      // nullable only because a row may belong to a geo prospect instead.
      leadId: sql<string>`${outreach.leadId}`,
      subject: outreach.subject,
      body: outreach.body,
      contact: leads.contact,
      company: leads.company,
    })
    .from(outreach)
    .innerJoin(leads, eq(leads.id, outreach.leadId))
    .where(
      and(
        isNotNull(outreach.verifiedAt),
        isNull(outreach.gmailDraftId),
        isNotNull(leads.contact),
      ),
    );

  if (!ready.length) {
    console.log("create-gmail-drafts: nothing verified and unsent");
    return;
  }

  const accessToken = await getAccessToken(readCredentials());
  let created = 0;

  for (const row of ready) {
    try {
      const draftId = await createDraft(accessToken, {
        // Cleaned again here: rows harvested before the extractor was fixed
        // still hold sentence punctuation, and Gmail refuses the whole draft.
        to: cleanEmail(row.contact)!,
        subject: row.subject,
        body: row.body,
      });

      await db
        .update(outreach)
        .set({ gmailDraftId: draftId })
        .where(eq(outreach.id, row.outreachId));

      await db.insert(events).values({
        leadId: row.leadId,
        type: "draft_created",
        meta: { gmailDraftId: draftId },
      });

      await db.update(leads).set({ status: "in_gmail" }).where(eq(leads.id, row.leadId));
      created += 1;
    } catch (err) {
      // One failure must not strand the rest. The row keeps gmailDraftId null,
      // so the next run retries exactly it and nothing else.
      console.error(`${row.company}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`create-gmail-drafts: created ${created} of ${ready.length} — drafts only, nothing sent`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
