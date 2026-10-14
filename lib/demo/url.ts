/**
 * Where published demos live.
 *
 * GitHub Pages, from this repository's gh-pages branch: free, already public,
 * and outside Vercel, whose Hobby plan is non-commercial (CLAUDE.md rule 4) and
 * whose deployments here are all behind Vercel Authentication, which a
 * prospect could never get past. Point DEMO_BASE_URL at a custom domain
 * (demo.joshuasenining.dev) once it is set up. The default address carries the
 * repository's name, and an owner reading "lead-engine" in a link learns
 * something about how they were found.
 */
export const DEFAULT_DEMO_BASE = "https://leewangyo97-dotcom.github.io/lead-engine";

export function demoBaseUrl(): string {
  return (process.env.DEMO_BASE_URL || DEFAULT_DEMO_BASE).replace(/\/+$/, "");
}

export function demoUrlFor(slug: string): string {
  return `${demoBaseUrl()}/${slug}/`;
}

/** The live demo's address, or null until one has been published. */
export function publishedDemoUrl(row: { demoSlug: string | null; demoPublishedAt: Date | null }): string | null {
  return row.demoSlug && row.demoPublishedAt ? demoUrlFor(row.demoSlug) : null;
}
