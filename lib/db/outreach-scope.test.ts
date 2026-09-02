import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every read of `outreach` has to say which funnel it means.
 *
 * The table holds job applications and messages to businesses, and three bugs
 * came from queries that forgot: the inbox counted prospect drafts as job
 * drafts, follow-ups skipped prospects entirely, and a written draft silenced a
 * company for ninety days. A database constraint now stops a row from belonging
 * to both, but it cannot stop a *read* from ignoring the distinction — that is
 * what this checks.
 *
 * It is a lint, not a proof: it reads source text and asks whether a scoping
 * clause appears near each query. A determined mistake will still get through.
 * It catches the one that actually happened three times, which is a query
 * written without the question being asked at all.
 */

const ROOTS = ["lib", "app", "scripts"];

/** Patterns that answer "which funnel is this?" for a query. */
const SCOPED = [
  "leadId",
  "prospectId",
  "lead_id",
  "prospect_id",
  "innerJoin(leads",
  "innerJoin(prospects",
];

/**
 * Queries that genuinely span both funnels, with the reason.
 *
 * Each entry is a promise that the query was written knowing the table holds
 * two kinds of row.
 */
const DELIBERATELY_UNSCOPED: Record<string, string> = {
  // Deletes by id after the caller has already chosen the rows.
  "lib/places/outreach-log.ts": "deletes a draft by its own id",
  // The schema file defines the table rather than querying it.
  "lib/db/schema.ts": "defines the table",
};

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      out.push(...sourceFiles(path));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(path);
    }
  }
  return out;
}

/** Query sites, as `{ file, line, snippet }` covering the following lines. */
function outreachQueries() {
  const found: { file: string; line: number; snippet: string }[] = [];

  for (const root of ROOTS) {
    for (const file of sourceFiles(root)) {
      const rel = file.replace(/\\/g, "/");
      if (rel in DELIBERATELY_UNSCOPED) continue;

      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, i) => {
        // Both spellings: the query builder and raw SQL inside sql``.
        if (!/\.from\(outreach\)|from outreach\b/.test(line)) return;
        // A query's scoping clause follows within a few lines in every style
        // used here; twelve is generous enough for a multi-line where().
        found.push({ file: rel, line: i + 1, snippet: lines.slice(i, i + 12).join("\n") });
      });
    }
  }

  return found;
}

describe("outreach queries name their funnel", () => {
  it("finds the query sites at all, so a passing run means something", () => {
    // Guards against the scan silently matching nothing after a refactor.
    expect(outreachQueries().length).toBeGreaterThan(5);
  });

  it("scopes every read to leads or to prospects", () => {
    const unscoped = outreachQueries()
      .filter((q) => !SCOPED.some((pattern) => q.snippet.includes(pattern)))
      .map((q) => `${q.file}:${q.line}`);

    expect(unscoped).toEqual([]);
  });
});
