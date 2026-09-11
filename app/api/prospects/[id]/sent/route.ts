import { markProspectSent } from "@/lib/places/outreach-log";

export const dynamic = "force-dynamic";

/**
 * Records that a Gmail draft was actually sent.
 *
 * The app holds `gmail.compose` and nothing else — it can create a draft and
 * cannot read the mailbox to find out what became of it. So this is a person
 * saying so, and it is the moment the follow-up ladder starts counting from.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const result = await markProspectSent(id);
  if (!result.ok) {
    // Ordinary, not a fault: the draft may already be marked, or this prospect
    // was reached by WhatsApp and never had one.
    return Response.json({ error: result.error }, { status: 409 });
  }

  return Response.json({ outreachId: result.outreachId });
}
