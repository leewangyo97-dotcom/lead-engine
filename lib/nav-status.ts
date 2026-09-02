import { sql } from "drizzle-orm";
import { getDb } from "./db";

/**
 * The counts and the health dot the sidebar carries in the design (Figma
 * 3:980): a number beside the sections that hold work, and one line saying
 * whether the pipeline is well.
 *
 * One query, not one per section. Six queries to render a sidebar would be six
 * round trips to a database that autosuspends, on every page.
 */
export interface NavStatus {
  counts: Record<string, number>;
  health: "ok" | "warn" | "fault";
  healthLabel: string;
}

export async function getNavStatus(): Promise<NavStatus> {
  const db = getDb();

  const [row] = (
    await db.execute(sql`
      select
        (select count(*) from leads where status = 'needs_scoring')::int as inbox,
        (select count(*) from leads)::int as leads,
        (select count(*) from outreach where due_at is not null and due_at <= now()
           and sent_at is null)::int as followups,
        (select count(*) from prospects where status = 'new'
           and (phone_e164 is not null or email is not null))::int as prospects,
        (select count(*) from sources where last_ok = false)::int as failed_sources,
        (select count(*) from sources where last_run_at < now() - interval '36 hours')::int as stale_sources
    `)
  ).rows as unknown as {
    inbox: number;
    leads: number;
    followups: number;
    prospects: number;
    failed_sources: number;
    stale_sources: number;
  }[];

  return {
    counts: {
      "/": row.inbox,
      "/prospects": row.prospects,
      "/followups": row.followups,
      "/rejected": row.leads,
    },
    ...classifyHealth(row.failed_sources, row.stale_sources),
  };
}

/**
 * A failed source is a fault; one that has simply not run recently is a warning.
 *
 * Saying "all systems normal" while a source has been dead for two days is the
 * exact failure this indicator exists to prevent, which is why it is a function
 * with tests rather than a ternary buried in a query.
 */
export function classifyHealth(
  failedSources: number,
  staleSources: number,
): { health: NavStatus["health"]; healthLabel: string } {
  if (failedSources > 0) {
    return {
      health: "fault",
      healthLabel: `${failedSources} source${failedSources === 1 ? "" : "s"} failing`,
    };
  }
  if (staleSources > 0) {
    return {
      health: "warn",
      healthLabel: `${staleSources} source${staleSources === 1 ? "" : "s"} stale`,
    };
  }
  return { health: "ok", healthLabel: "All systems normal" };
}
