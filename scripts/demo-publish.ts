import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "../lib/db";
import { prospects } from "../lib/db/schema";
import { loadLocalEnv } from "../lib/env";
import { demoIneligible, renderDemo, type DemoPlace } from "../lib/demo/render";
import { demoUrlFor } from "../lib/demo/url";

/**
 * Publishes one demo page to GitHub Pages and records it on the prospect.
 *
 *   pnpm demo:publish --id=<prospect id>
 *   pnpm demo:publish --sample            a made-up business, to check the pipeline
 *   pnpm demo:publish --id=<id> --dry     render into .demo-site only, no push
 *
 * The page goes to the gh-pages branch through a git worktree at .demo-site,
 * created on first use, so the main checkout is never switched. The same script
 * runs in `.github/workflows/demo.yml`, which the Demo button starts.
 *
 * The prospect is marked published only once the page loads at its address.
 * The first email links to it, and GitHub Pages takes a minute or two after a
 * push. Recording on the push alone left that window for an email to link a
 * 404 (verifier, 14 Oct). A link to a page that is not there is worse than no
 * link at all.
 */
const SITE = ".demo-site";
const BRANCH = "gh-pages";

const SAMPLE: DemoPlace = {
  id: "sample0",
  name: "Bay Dental Studio (sample)",
  category: "dentists",
  city: "Sydney",
  addressLine: "1 Example Street, Sydney NSW",
  website: null,
  email: "hello@example.com",
  phoneE164: "+61290000000",
  whatsappE164: null,
  lat: null,
  lon: null,
};

function git(args: string[], cwd = "."): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function remoteHasBranch(): boolean {
  try {
    git(["fetch", "origin", BRANCH]);
    return true;
  } catch {
    return false;
  }
}

/** A worktree on gh-pages, up to date with the remote, or a new orphan branch. */
function prepareSite(): void {
  const remote = remoteHasBranch();
  if (!existsSync(join(SITE, ".git"))) {
    if (remote) git(["worktree", "add", "-B", BRANCH, SITE, `origin/${BRANCH}`]);
    else git(["worktree", "add", "--orphan", "-b", BRANCH, SITE]);
  } else if (remote) {
    git(["checkout", BRANCH], SITE);
    git(["reset", "--hard", `origin/${BRANCH}`], SITE);
  }
  // GitHub Pages would otherwise run Jekyll over the pages.
  writeFileSync(join(SITE, ".nojekyll"), "");
}

function publish(place: DemoPlace, push: boolean): string {
  const { slug, html } = renderDemo(place);
  prepareSite();
  mkdirSync(join(SITE, slug), { recursive: true });
  writeFileSync(join(SITE, slug, "index.html"), html);
  if (!push) return slug;

  git(["add", "-A"], SITE);
  if (git(["status", "--porcelain"], SITE)) {
    git(["commit", "-m", `demo: ${slug}`], SITE);
  }
  git(["push", "origin", BRANCH], SITE);
  return slug;
}

/** Waits for the page to answer 200, up to five minutes. */
async function waitUntilLive(url: string, timeoutMs = 5 * 60_000): Promise<boolean> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      if ((await fetch(url, { cache: "no-store" })).ok) return true;
    } catch {
      // Not up yet, or a blip: try again.
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  return false;
}

async function main() {
  loadLocalEnv();
  const push = !process.argv.includes("--dry");

  if (process.argv.includes("--sample")) {
    const slug = publish(SAMPLE, push);
    const live = push && (await waitUntilLive(demoUrlFor(slug)));
    console.log(`demo:publish: sample ${live ? "live" : push ? "pushed, not live yet" : "rendered"} at ${demoUrlFor(slug)}`);
    return;
  }

  const id = process.argv.find((a) => a.startsWith("--id="))?.slice("--id=".length) ?? "";
  if (!/^[a-z0-9]{8,40}$/.test(id)) throw new Error("--id=<prospect id> is required");
  const db = getDb();
  const [place] = await db.select().from(prospects).where(eq(prospects.id, id)).limit(1);
  if (!place) throw new Error(`no prospect ${id}`);
  const ineligible = demoIneligible(place);
  if (ineligible) throw new Error(`no demo for ${place.name}: ${ineligible}`);

  const slug = publish(place, push);
  if (!push) {
    console.log(`demo:publish: rendered ${join(SITE, slug, "index.html")} (not pushed, not recorded)`);
    return;
  }
  const url = demoUrlFor(slug);
  if (!(await waitUntilLive(url))) {
    throw new Error(`pushed, but ${url} is not live yet. Run this again in a few minutes; it records the page once it loads.`);
  }
  await db
    .update(prospects)
    .set({ demoSlug: slug, demoPublishedAt: new Date() })
    .where(eq(prospects.id, id));
  console.log(`demo:publish: ${place.name} at ${demoUrlFor(slug)}`);
}

main().catch((err) => {
  console.error("demo:publish:", err instanceof Error ? err.message : err);
  process.exit(1);
});
