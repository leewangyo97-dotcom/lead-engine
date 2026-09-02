import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../lib/db";
import { loadLocalEnv } from "../lib/env";
import { outreach, prospects } from "../lib/db/schema";
import { EnhanceBatch, readValidatedStdin } from "../lib/model/schemas";
import { signalKeys } from "../lib/places/enhance";
import { verifyMessage } from "../lib/places/message-verify";
import { DRAFT_STEP } from "../lib/places/outreach-log";

/**
 * Stores enhanced messages as unsent drafts.
 *
 * `sentAt` stays null, which is what makes a row a draft rather than a record of
 * something that happened. The UI shows it beside the original and a person
 * decides; nothing here may promote a draft to sent.
 */
async function main() {
  loadLocalEnv();
  const db = getDb();
  const { enhanced } = await readValidatedStdin(EnhanceBatch);

  const ids = enhanced.map((e) => e.prospectId);
  const rows = await db.select().from(prospects).where(inArray(prospects.id, ids));
  const byId = new Map(rows.map((r) => [r.id, r]));

  const unknown = enhanced.filter((e) => !byId.has(e.prospectId));
  if (unknown.length) {
    console.error(`${unknown.length} message(s) reference prospects that do not exist`);
    process.exit(1);
  }

  // A message claiming a signal the prospect does not have is a message about a
  // business that does not exist. Rejecting the batch is right: a half-applied
  // set leaves nobody able to say which messages were checked.
  const invented = enhanced.filter((e) => {
    const known = new Set(signalKeys(byId.get(e.prospectId)!));
    return e.usedSignals.some((s) => !known.has(s));
  });
  if (invented.length) {
    for (const e of invented) {
      const known = signalKeys(byId.get(e.prospectId)!);
      console.error(
        `${byId.get(e.prospectId)!.name}: claims signals [${e.usedSignals.join(", ")}], known are [${known.join(", ")}]`,
      );
    }
    process.exit(1);
  }

  // Declaring honest signals is not the same as writing an honest message. A
  // draft once claimed a site was insecure while every signal it declared was
  // real, so the text is checked against the facts as well as the keys.
  const untrue = enhanced.flatMap((e) => {
    const known = signalKeys(byId.get(e.prospectId)!);
    return verifyMessage(e.message, known).map((v) => ({ e, v }));
  });
  if (untrue.length) {
    for (const { e, v } of untrue) {
      console.error(`${byId.get(e.prospectId)!.name}: "${v.quote}" — ${v.reason}`);
    }
    process.exit(1);
  }

  for (const e of enhanced) {
    const place = byId.get(e.prospectId)!;
    // One draft per prospect: a stack of them is a decision nobody made.
    await db
      .delete(outreach)
      .where(and(eq(outreach.prospectId, e.prospectId), eq(outreach.step, DRAFT_STEP)));

    await db.insert(outreach).values({
      prospectId: e.prospectId,
      channel: place.whatsappE164 || place.phoneE164 ? "whatsapp" : "email",
      step: DRAFT_STEP,
      subject: `Enhanced message for ${place.name}`,
      body: e.message,
      angle: e.angle,
      proofUsed: e.usedSignals,
      sentAt: null,
      verifiedAt: null,
    });
  }

  console.log(`apply:enhance: ${enhanced.length} draft(s) stored, awaiting review`);
}

main().catch((err) => {
  console.error("apply:enhance:", err instanceof Error ? err.message : err);
  process.exit(1);
});
