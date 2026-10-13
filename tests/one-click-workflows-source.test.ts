import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The two buttons that start GitHub Actions, checked by shape: no runner here
 * can execute a workflow, and what matters is how each one is wired.
 *
 * Enhance runs Claude Code on Joshua's subscription token. That token, and the
 * database URL, are the two secrets in play, so the checks below are mostly
 * about which step can see which.
 */
const ENHANCE = readFileSync(".github/workflows/enhance.yml", "utf8");
const SEARCH = readFileSync(".github/workflows/search-run.yml", "utf8");
const ENHANCE_ROUTE = readFileSync("app/api/prospects/[id]/enhance/route.ts", "utf8");
const SEARCH_ROUTE = readFileSync("app/api/searches/run/route.ts", "utf8");
const PANEL = readFileSync("app/components/prospect-enhance.tsx", "utf8");

/** One step of a workflow, from its `- name:` to the next. */
function step(source: string, name: string): string {
  const start = source.indexOf(`- name: ${name}`);
  expect(start).toBeGreaterThan(-1);
  const next = source.indexOf("\n      - ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

describe("enhance.yml", () => {
  it("is found again by the title the route looks for", () => {
    expect(ENHANCE).toContain("run-name: Enhance ${{ inputs.prospect_id }}");
    expect(ENHANCE_ROUTE).toContain("`Enhance ${id}`");
  });

  it("never pastes the input into a shell script", () => {
    for (const line of ENHANCE.split("\n").filter((l) => /^\s+run:/.test(l))) {
      expect(line).not.toContain("${{");
    }
    expect(step(ENHANCE, "Build the prompt")).toContain('--id="$PROSPECT_ID"');
  });

  it("runs Claude Code on the subscription token, never an API key", () => {
    const ask = step(ENHANCE, "Ask Claude");
    expect(ask).toContain("CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}");
    expect(ENHANCE).not.toMatch(/ANTHROPIC_API_KEY/);
  });

  it("gives Claude no tools, no checkout and no database", () => {
    const ask = step(ENHANCE, "Ask Claude");
    expect(ask).toContain('--tools ""');
    expect(ask).toContain("working-directory: ${{ runner.temp }}");
    expect(ask).not.toContain("DATABASE_URL");
  });

  it("pins the Claude Code version, so a release cannot change the job unseen", () => {
    expect(step(ENHANCE, "Ask Claude")).toMatch(/@anthropic-ai\/claude-code@\d+\.\d+\.\d+/);
  });

  it("stores the answer only through apply:enhance and its checks", () => {
    expect(step(ENHANCE, "Store the draft")).toContain("pnpm -s claude:unwrap");
    expect(step(ENHANCE, "Store the draft")).toContain("| pnpm -s apply:enhance");
  });
});

describe("search-run.yml", () => {
  it("is the terminal command it replaced, under the title the route looks for", () => {
    expect(step(SEARCH, "Drain the search queue")).toContain("pnpm search:run --drain");
    expect(SEARCH).toContain("run-name: Run queued searches");
    expect(SEARCH_ROUTE).toContain('"Run queued searches"');
  });

  it("never runs two drains at once", () => {
    expect(SEARCH).toMatch(/concurrency:\s*\n\s*group: search-run\s*\n\s*cancel-in-progress: false/);
  });
});

describe("the Enhance panel", () => {
  it("starts Claude when opened with no draft — one click, as asked on 13 Oct", () => {
    const load = PANEL.slice(PANEL.indexOf("async function load("), PANEL.indexOf("useEffect("));
    expect(load).toMatch(/!loaded\.draft && waitingSince === null\)[\s\S]*await start\(null\)/);
  });

  it("watches a run that is already going rather than starting a second", () => {
    expect(PANEL).toMatch(/if \(isRunning\(loaded\.run\)\)/);
  });
});
