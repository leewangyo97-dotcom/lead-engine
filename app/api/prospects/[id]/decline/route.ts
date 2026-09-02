import { decline } from "@/lib/places/outreach-log";

export const dynamic = "force-dynamic";

/** Records a "no" and puts every identifier this prospect owns on the list. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let reason: string | undefined;
  try {
    const body = await request.json();
    if (typeof body?.reason === "string" && body.reason.trim()) reason = body.reason.trim();
  } catch {
    // A missing body is fine — the reason is optional, the refusal is not.
  }

  const result = await decline(id, reason);
  if (!result.ok) return Response.json({ error: result.error }, { status: 404 });

  return Response.json(result);
}
