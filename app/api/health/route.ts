import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// Phase 0 exit test: this route proves @neondatabase/serverless connects.
export async function GET() {
  try {
    const db = getDb();
    const rows = await db.execute(sql`select 1 as ok`);
    return Response.json({ ok: true, db: rows.rows.length === 1 });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }
}
