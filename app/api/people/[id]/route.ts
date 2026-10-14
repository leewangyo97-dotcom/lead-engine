import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { people, suppressions } from "@/lib/db/schema";
import { suppress } from "@/lib/places/outreach-log";
import { blockedOf, personDetail } from "@/lib/people/queries";
import { isStatus } from "@/lib/people/status";

export const dynamic = "force-dynamic";

/** Why a person's address is on the do-not-contact list, so undo can find it. */
const REASON = "decision-maker marked do not contact";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await personDetail(id);
  return detail ? Response.json(detail) : Response.json({ error: "no such person" }, { status: 404 });
}

/**
 * Status and notes. "Do not contact" puts the person's address on the shared
 * do-not-contact list, so every export and send path refuses it. Moving off
 * that status takes off only the entry this route put there.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: { status?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }
  if (body.status !== undefined && !isStatus(body.status)) {
    return Response.json({ error: "unknown status" }, { status: 400 });
  }

  const db = getDb();
  const [person] = await db.select().from(people).where(eq(people.id, id)).limit(1);
  if (!person) return Response.json({ error: "no such person" }, { status: 404 });

  await db
    .update(people)
    .set({
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.notes !== undefined ? { notes: body.notes.slice(0, 2000) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(people.id, id));

  const email = person.email?.toLowerCase();
  if (email && body.status === "do_not_contact") {
    await suppress("email", email, REASON);
  } else if (email && body.status && person.status === "do_not_contact") {
    await db
      .delete(suppressions)
      .where(and(eq(suppressions.kind, "email"), eq(suppressions.value, email), eq(suppressions.reason, REASON)));
  }
  // The page shows the list's answer, not its own guess: a domain on the list
  // keeps them blocked whatever their status says.
  return Response.json({ ok: true, blocked: await blockedOf(id) });
}

/**
 * Deletes the person and, by cascade, every source row about them: the
 * "erase me" request under the Data Privacy Act and GDPR. An address already
 * on the do-not-contact list stays there, so a later discovery cannot bring
 * them back into an export.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = await getDb().delete(people).where(eq(people.id, id)).returning({ id: people.id });
  return deleted.length ? Response.json({ ok: true }) : Response.json({ error: "no such person" }, { status: 404 });
}
