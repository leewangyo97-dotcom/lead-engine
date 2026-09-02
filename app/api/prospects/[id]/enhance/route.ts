import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { outreach, prospects } from "@/lib/db/schema";
import { buildEnhancePrompt } from "@/lib/places/enhance";
import { firstMessage } from "@/lib/places/contact";
import { DRAFT_STEP } from "@/lib/places/outreach-log";

export const dynamic = "force-dynamic";

/**
 * Hands back the prompt for one prospect, plus whatever draft already exists.
 *
 * The model is not called here. Model work in this project runs inside Claude
 * Code, so this returns the prompt to paste and `pnpm apply:enhance` brings the
 * answer back — the same split scoring and drafting already use, rather than a
 * second path that would have to be secured and budgeted separately.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const [place] = await db.select().from(prospects).where(eq(prospects.id, id)).limit(1);
  if (!place) return Response.json({ error: "no such prospect" }, { status: 404 });

  const [draft] = await db
    .select({ id: outreach.id, body: outreach.body, angle: outreach.angle })
    .from(outreach)
    .where(and(eq(outreach.prospectId, id), eq(outreach.step, DRAFT_STEP)))
    .limit(1);

  return Response.json({
    current: firstMessage(place),
    draft: draft ?? null,
    prompt: buildEnhancePrompt([place]),
  });
}

/** Discards a draft, restoring the generated message. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  await db
    .delete(outreach)
    .where(and(eq(outreach.prospectId, id), eq(outreach.step, DRAFT_STEP)));

  return Response.json({ ok: true });
}
