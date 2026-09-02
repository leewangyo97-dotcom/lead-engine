import { logContact } from "@/lib/places/outreach-log";

export const dynamic = "force-dynamic";

/**
 * Logs an outreach and hands back the link to open.
 *
 * The browser opens the link, but the server decides what it says and whether it
 * is allowed at all — a do-not-contact entry has to win over a click, and the
 * message that gets recorded has to be the message that gets sent.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: { channel?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }

  if (body.channel !== "whatsapp" && body.channel !== "email") {
    return Response.json({ error: "channel must be whatsapp or email" }, { status: 400 });
  }

  const result = await logContact(id, body.channel);
  if (!result.ok) {
    // A refusal is an ordinary outcome here, not a server fault: no phone, a
    // landline, or a prospect who asked not to be contacted.
    return Response.json({ error: result.blocked }, { status: 409 });
  }

  return Response.json({ outreachId: result.outreachId, href: result.href });
}
