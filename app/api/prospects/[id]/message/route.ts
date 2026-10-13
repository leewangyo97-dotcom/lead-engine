import { composeContact, recordCopiedEmail } from "@/lib/places/outreach-log";
import { cleanEmail } from "@/lib/sources/email";

export const dynamic = "force-dynamic";

/**
 * The email the next click would send, for the row's "Copy email" button.
 *
 * Read-only: it records nothing and creates no draft — copying is not sending,
 * and the follow-up clock still starts only at "I sent it". It refuses the same
 * prospects the Email button refuses (do-not-contact, suppressed, a finished
 * ladder), so a copied message can never be one the app would not send.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const composed = await composeContact(id, "email");
  if (!composed.ok) {
    return Response.json({ error: composed.blocked }, { status: 409 });
  }
  const to = composed.place.email;
  return Response.json({
    subject: composed.subject,
    body: composed.body,
    to: to ? (cleanEmail(to) ?? to) : null,
  });
}

/** "I sent it" for a copied email — see `recordCopiedEmail`. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await recordCopiedEmail(id);
  if (!result.ok) return Response.json({ error: result.error }, { status: 409 });
  return Response.json(result);
}
