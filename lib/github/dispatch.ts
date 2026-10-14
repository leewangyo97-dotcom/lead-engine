/**
 * Starting a GitHub Actions workflow from the website, and asking how it went.
 *
 * Two jobs cannot run inside a Vercel request. A country-wide search takes
 * minutes, and the function would be cut off. Enhancing a message needs a model,
 * and the model in this project is Claude Code on Joshua's own subscription
 * (DECISIONS 002), never a server-side API key. Actions does both: the button
 * starts a run, and the run writes its result to the database the site reads.
 *
 * The token is a fine-grained GitHub token for this one repository, with
 * Actions read and write and nothing else. Without it, the buttons fall back to
 * the commands they replaced, and say so.
 */
export const REPO =
  process.env.GITHUB_DISPATCH_REPO ||
  (process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG
    ? `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}`
    : "leewangyo97-dotcom/lead-engine");

const API = "https://api.github.com";

export function dispatchConfigured(): boolean {
  return Boolean(process.env.GITHUB_DISPATCH_TOKEN);
}

function headers(): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${process.env.GITHUB_DISPATCH_TOKEN}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export type Dispatched = { ok: true } | { ok: false; error: string };

export async function dispatchWorkflow(
  workflow: string,
  inputs: Record<string, string> = {},
): Promise<Dispatched> {
  if (!dispatchConfigured()) {
    return { ok: false, error: "GITHUB_DISPATCH_TOKEN is not set, so this runs from the terminal" };
  }
  const res = await fetch(`${API}/repos/${REPO}/actions/workflows/${workflow}/dispatches`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ ref: "main", inputs }),
  });
  // 204 historically; newer API versions may answer 200 with the run's details.
  if (res.ok) return { ok: true };
  const detail = await res.text().catch(() => "");
  return { ok: false, error: `GitHub refused the run (${res.status}) ${detail.slice(0, 200)}`.trim() };
}

export interface WorkflowRun {
  /** `queued`, `in_progress` or `completed` — and a few rarer waiting states. */
  status: string;
  /** Set once completed: `success`, `failure`, `cancelled`, … */
  conclusion: string | null;
  url: string;
  createdAt: string;
}

/**
 * The newest run of `workflow` whose title is `title`, or null.
 *
 * Runs are told apart by title because a dispatch returns no run id: each
 * workflow names its runs with its input (`run-name:`), and that is what is
 * matched here.
 */
export async function latestRun(workflow: string, title: string): Promise<WorkflowRun | null> {
  if (!dispatchConfigured()) return null;
  const res = await fetch(
    `${API}/repos/${REPO}/actions/workflows/${workflow}/runs?event=workflow_dispatch&per_page=20`,
    { headers: headers(), cache: "no-store" },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    workflow_runs?: {
      display_title: string;
      status: string;
      conclusion: string | null;
      html_url: string;
      created_at: string;
    }[];
  };
  const run = data.workflow_runs?.find((r) => r.display_title === title);
  return run
    ? { status: run.status, conclusion: run.conclusion, url: run.html_url, createdAt: run.created_at }
    : null;
}

/** True while a run is still going: anything not yet completed. */
export function running(run: WorkflowRun | null): boolean {
  return run !== null && run.status !== "completed";
}
