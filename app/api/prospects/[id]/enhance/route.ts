import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { outreach, prospects } from "@/lib/db/schema";
import { buildEnhancePrompt } from "@/lib/places/enhance";
import { firstMessage } from "@/lib/places/contact";
import { DRAFT_STEP } from "@/lib/places/outreach-log";
import { dispatchConfigured, dispatchWorkflow, latestRun } from "@/lib/github/dispatch";
import { publicDomain, publicReason } from "@/lib/places/public-institution";

const WORKFLOW = "enhance.yml";
/** The run title `enhance.yml` gives itself, which is how a run is found again. */
const runTitle = (id: string) => `Enhance ${id}`;

export const dynamic = "force-dynamic";

/**
 * Hands back the prompt for one prospect, plus whatever draft already exists.
 *
 * The model is not called here. Model work in this project runs inside Claude
 * Code, so this returns the prompt to paste and `pnpm apply:enhance` brings the
 * answer back — the same split scoring and drafting already use, rather than a
 * second path that would have to be secured and budgeted separately.
 *
 * `run` is the latest one-click run for this prospect (see POST), so the panel
 * can say "writing…", show the draft when it lands, or say the run failed.
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
    oneClick: dispatchConfigured(),
    run: await latestRun(WORKFLOW, runTitle(id)),
  });
}

/**
 * Enhance in one click: starts `enhance.yml`, which runs this prospect's prompt
 * through Claude Code on Joshua's subscription and stores the answer through
 * `apply:enhance`, checks and all. Nothing is written here. The draft arrives in
 * a minute or two, and GET reports progress until it does.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [place] = await getDb()
    .select({ id: prospects.id, status: prospects.status, email: prospects.email })
    .from(prospects)
    .where(eq(prospects.id, id))
    .limit(1);
  if (!place) return Response.json({ error: "no such prospect" }, { status: 404 });
  if (place.status === "do_not_contact") {
    return Response.json({ error: "marked do-not-contact" }, { status: 409 });
  }
  const publicBody = publicDomain(place.email);
  if (publicBody) return Response.json({ error: publicReason(publicBody) }, { status: 409 });

  const started = await dispatchWorkflow(WORKFLOW, { prospect_id: id });
  if (!started.ok) return Response.json({ error: started.error }, { status: 503 });
  return Response.json({ started: true }, { status: 202 });
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
