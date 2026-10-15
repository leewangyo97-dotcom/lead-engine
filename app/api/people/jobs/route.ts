import { dispatchConfigured, dispatchWorkflow } from "@/lib/github/dispatch";
import { addCompany, createJob, MAX_PER_JOB, recentJobs, seedFromLeads, seedFromProspects } from "@/lib/people/jobs";

export const dynamic = "force-dynamic";

/** The recent discovery jobs and their progress, for the page to poll. */
export async function GET() {
  const jobs = await recentJobs(5);
  return Response.json({ jobs, oneClick: dispatchConfigured() });
}

/**
 * Starts discovery: adds the companies (from local businesses, from job leads,
 * or one domain), queues a job for them, and starts `discover.yml` to run it.
 * Without GITHUB_DISPATCH_TOKEN the job stays queued and the answer carries
 * the command that runs it.
 */
export async function POST(request: Request) {
  let body: {
    seed?: string;
    limit?: number;
    domain?: string;
    name?: string;
    countryCode?: string;
    /** "From local businesses" narrowed to the chips chosen on /people. */
    country?: string;
    category?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }
  const limit = Math.min(Math.max(1, Number(body.limit ?? 10)), MAX_PER_JOB);

  let companyIds: string[];
  try {
    if (body.domain) companyIds = [await addCompany({ domain: body.domain, name: body.name, countryCode: body.countryCode })];
    else if (body.seed === "prospects") {
      companyIds = await seedFromProspects(limit, {
        countryCode: /^[A-Za-z]{2}$/.test(body.country ?? "") ? body.country!.toUpperCase() : undefined,
        category: body.category?.trim() || undefined,
      });
    }
    else if (body.seed === "leads") companyIds = await seedFromLeads(limit);
    else return Response.json({ error: "give a domain, or seed: prospects | leads" }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "could not add" }, { status: 409 });
  }
  if (companyIds.length === 0) return Response.json({ error: "no new companies to add" }, { status: 409 });

  const jobId = await createJob(companyIds);
  const command = `pnpm people:discover --job=${jobId}`;
  const started = await dispatchWorkflow("discover.yml", { job_id: jobId });
  return Response.json(
    { jobId, companies: companyIds.length, started: started.ok, ...(started.ok ? {} : { command, note: started.error }) },
    { status: 202 },
  );
}
