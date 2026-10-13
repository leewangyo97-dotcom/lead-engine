import { afterEach, describe, expect, it, vi } from "vitest";
import { dispatchWorkflow, latestRun, REPO, running } from "./dispatch";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function stubFetch(response: Response) {
  const fetch = vi.fn(async () => response);
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("dispatchWorkflow", () => {
  it("says it cannot run, and calls nobody, when no token is set", async () => {
    vi.stubEnv("GITHUB_DISPATCH_TOKEN", "");
    const fetch = stubFetch(new Response(null, { status: 204 }));
    const result = await dispatchWorkflow("enhance.yml", { prospect_id: "p1" });
    expect(result).toEqual({ ok: false, error: expect.stringContaining("GITHUB_DISPATCH_TOKEN") });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("starts the workflow on main with its inputs", async () => {
    vi.stubEnv("GITHUB_DISPATCH_TOKEN", "test-token");
    const fetch = stubFetch(new Response(null, { status: 204 }));
    expect(await dispatchWorkflow("enhance.yml", { prospect_id: "p1" })).toEqual({ ok: true });

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.github.com/repos/${REPO}/actions/workflows/enhance.yml/dispatches`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ ref: "main", inputs: { prospect_id: "p1" } });
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
  });

  it("passes GitHub's refusal on rather than claiming the run started", async () => {
    vi.stubEnv("GITHUB_DISPATCH_TOKEN", "test-token");
    stubFetch(new Response("Bad credentials", { status: 401 }));
    const result = await dispatchWorkflow("enhance.yml");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/401.*Bad credentials/);
  });
});

describe("latestRun", () => {
  const runs = {
    workflow_runs: [
      { display_title: "Enhance other", status: "completed", conclusion: "success", html_url: "u1", created_at: "2026-10-13T08:00:00Z" },
      { display_title: "Enhance p1", status: "in_progress", conclusion: null, html_url: "u2", created_at: "2026-10-13T07:00:00Z" },
    ],
  };

  it("finds this prospect's run by its title", async () => {
    vi.stubEnv("GITHUB_DISPATCH_TOKEN", "test-token");
    stubFetch(Response.json(runs));
    const run = await latestRun("enhance.yml", "Enhance p1");
    expect(run).toEqual({ status: "in_progress", conclusion: null, url: "u2", createdAt: "2026-10-13T07:00:00Z" });
    expect(running(run)).toBe(true);
  });

  it("is null without a token, and when no run matches", async () => {
    vi.stubEnv("GITHUB_DISPATCH_TOKEN", "");
    expect(await latestRun("enhance.yml", "Enhance p1")).toBeNull();
    vi.stubEnv("GITHUB_DISPATCH_TOKEN", "test-token");
    stubFetch(Response.json(runs));
    expect(await latestRun("enhance.yml", "Enhance nobody")).toBeNull();
    expect(running(null)).toBe(false);
  });
});
