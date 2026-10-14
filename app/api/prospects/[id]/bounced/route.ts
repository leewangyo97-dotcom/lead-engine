import { setBounced } from "@/lib/places/bounce";

export const dynamic = "force-dynamic";

/**
 * "It bounced": blocks the prospect's current email address on the email
 * channel only (lib/places/bounce.ts). Phone and WhatsApp stay open, and any
 * email follow-up due is refused rather than bounced a second time.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await setBounced(id, true);
  if (!result.ok) return Response.json({ error: result.error }, { status: 409 });
  return Response.json(result);
}

/** Undo, for a bounce marked by mistake. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await setBounced(id, false);
  if (!result.ok) return Response.json({ error: result.error }, { status: 409 });
  return Response.json(result);
}
