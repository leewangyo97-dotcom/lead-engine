import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { prospects } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/**
 * Records what came back from a message.
 *
 * A prospect has no events table behind it, so its status is the whole record —
 * which is why this endpoint exists at all. Without it the follow-up ladder
 * never stops for anyone who replied, and the weekly review counts sends with
 * no outcomes against them.
 */
const OUTCOMES = {
  replied: "replied",
  won: "won",
  lost: "lost",
  // Back to the ladder: a mistaken click should not silently end a conversation.
  reopen: "contacted",
} as const;

export function isOutcome(value: string): value is keyof typeof OUTCOMES {
  return value in OUTCOMES;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: { outcome?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }

  if (!body.outcome || !isOutcome(body.outcome)) {
    return Response.json(
      { error: `outcome must be one of ${Object.keys(OUTCOMES).join(", ")}` },
      { status: 400 },
    );
  }

  const db = getDb();
  const [row] = await db
    .update(prospects)
    .set({ status: OUTCOMES[body.outcome], updatedAt: new Date() })
    .where(eq(prospects.id, id))
    .returning({ id: prospects.id, status: prospects.status });

  if (!row) return Response.json({ error: "no such prospect" }, { status: 404 });
  return Response.json(row);
}
