import { dispatchConfigured, dispatchWorkflow, latestRun } from "@/lib/github/dispatch";

export const dynamic = "force-dynamic";

const WORKFLOW = "search-run.yml";
/** The run title `search-run.yml` gives itself. */
const TITLE = "Run queued searches";

/** Whether "Run now" can work here, and how its last run went. */
export async function GET() {
  return Response.json({ oneClick: dispatchConfigured(), run: await latestRun(WORKFLOW, TITLE) });
}

/**
 * "Run now": starts `search-run.yml`, the `pnpm search:run --drain` that used
 * to need a terminal. It runs on GitHub, because a country-wide search takes
 * longer than a request here may stay open.
 */
export async function POST() {
  const started = await dispatchWorkflow(WORKFLOW);
  if (!started.ok) return Response.json({ error: started.error }, { status: 503 });
  return Response.json({ started: true }, { status: 202 });
}
