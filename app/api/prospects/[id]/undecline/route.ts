import { undecline } from "@/lib/places/outreach-log";

export const dynamic = "force-dynamic";

/**
 * Takes a prospect back off the do-not-contact list.
 *
 * Declining was the only one-way door in this app. It is one click behind one
 * confirmation, and it writes suppression entries keyed on the phone number,
 * email and domain rather than on the prospect — so undoing it by hand meant
 * knowing which rows in `suppressions` came from which refusal.
 *
 * The reply says what was released and what was kept, because "kept" is the
 * interesting case: an identifier another declined business also owns stays on
 * the list, and the prospect will still be refused when someone tries to
 * message it.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const result = await undecline(id);
  if (!result.ok) return Response.json({ error: result.error }, { status: 404 });

  return Response.json(result);
}
