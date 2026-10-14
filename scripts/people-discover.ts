import { loadLocalEnv } from "../lib/env";
import { createJob, queuedJobIds, runJob, seedFromLeads, seedFromProspects } from "../lib/people/jobs";

/**
 * Runs decision-maker discovery (lib/people).
 *
 *   pnpm people:discover --job=<id>                  one job, as the Discover button queued it
 *   pnpm people:discover --queued                    every queued job
 *   pnpm people:discover --seed=prospects --limit=10 add companies, then discover them now
 *   pnpm people:discover --seed=leads --limit=10
 *
 * The /people page starts the same thing on GitHub Actions (discover.yml)
 * once GITHUB_DISPATCH_TOKEN is set. Output is counts only, because the
 * Actions logs of this repository are public.
 */
async function main() {
  loadLocalEnv();
  const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

  const job = arg("job");
  if (job) {
    await runJob(job);
    console.log("people:discover: job done");
    return;
  }

  if (process.argv.includes("--queued")) {
    const ids = await queuedJobIds();
    for (const id of ids) await runJob(id);
    console.log(`people:discover: ${ids.length} queued job(s) run`);
    return;
  }

  const seed = arg("seed");
  if (seed === "prospects" || seed === "leads") {
    const limit = Math.min(Number(arg("limit") ?? 10), 50);
    const ids = seed === "prospects" ? await seedFromProspects(limit) : await seedFromLeads(limit);
    if (ids.length === 0) {
      console.log("people:discover: no new companies to add");
      return;
    }
    const id = await createJob(ids);
    await runJob(id);
    console.log(`people:discover: ${ids.length} companies from ${seed} discovered`);
    return;
  }

  throw new Error("use --job=<id>, --queued, or --seed=prospects|leads [--limit=N]");
}

main().catch((err) => {
  console.error("people:discover:", err instanceof Error ? err.message : err);
  process.exit(1);
});
