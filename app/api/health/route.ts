import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { getPipelineFaults } from "@/lib/leads/health-query";

export const dynamic = "force-dynamic";

// Phase 0 exit test: this route proves @neondatabase/serverless connects.
export async function GET() {
  try {
    const db = getDb();
    const rows = await db.execute(sql`select 1 as ok`);
    const faults = await getPipelineFaults();

    // A reachable database is not a working pipeline. 200 with faults listed
    // says both things honestly rather than reporting health it cannot vouch for.
    return Response.json({
      ok: faults.length === 0,
      db: rows.rows.length === 1,
      faults,
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }
}
