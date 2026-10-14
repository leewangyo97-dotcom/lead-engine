import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { prospects } from "@/lib/db/schema";
import { demoIneligible, renderDemo } from "@/lib/demo/render";
import { publishedDemoUrl } from "@/lib/demo/url";
import { dispatchConfigured, dispatchWorkflow, latestRun } from "@/lib/github/dispatch";

export const dynamic = "force-dynamic";

const WORKFLOW = "demo.yml";
/** The run title `demo.yml` gives itself, which is how a run is found again. */
const runTitle = (id: string) => `Demo ${id}`;

async function load(id: string) {
  const [place] = await getDb().select().from(prospects).where(eq(prospects.id, id)).limit(1);
  return place;
}

/**
 * A prospect's demo page: `?preview=1` renders it here, before anything is
 * published (this app is behind Vercel Authentication, so the preview is
 * Joshua's alone). Otherwise, whether it can have one, and where it lives.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const place = await load(id);
  if (!place) return Response.json({ error: "no such prospect" }, { status: 404 });

  if (new URL(request.url).searchParams.get("preview")) {
    return new Response(renderDemo(place).html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return Response.json({
    ineligible: demoIneligible(place),
    url: publishedDemoUrl(place),
    publishedAt: place.demoPublishedAt,
    oneClick: dispatchConfigured(),
    run: await latestRun(WORKFLOW, runTitle(id)),
    command: `pnpm demo:publish --id=${id}`,
  });
}

/**
 * Publishes the demo: starts `demo.yml`, which renders the page, pushes it to
 * the gh-pages branch, and records it on the prospect. Nothing is written
 * here. The page is live in a minute or two, and GET reports progress.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const place = await load(id);
  if (!place) return Response.json({ error: "no such prospect" }, { status: 404 });

  const ineligible = demoIneligible(place);
  if (ineligible) return Response.json({ error: `no demo: ${ineligible}` }, { status: 409 });

  const started = await dispatchWorkflow(WORKFLOW, { prospect_id: id });
  if (!started.ok) {
    return Response.json({ error: started.error, command: `pnpm demo:publish --id=${id}` }, { status: 503 });
  }
  return Response.json({ started: true }, { status: 202 });
}
