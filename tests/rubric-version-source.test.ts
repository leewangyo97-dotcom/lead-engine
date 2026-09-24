import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RUBRIC_VERSION } from "../lib/scoring/prescore";

/**
 * The rubric's header must name the version the code scores with.
 *
 * `scorer` reads memory/RUBRIC.md, and its header said 1.1.0 for twelve days
 * after rubric 1.2.0 shipped — the weights table and the tuning log below it
 * had both moved, the one line a reader checks first had not. Scores were right
 * only because the version is recorded from `RUBRIC_VERSION`, not from the doc.
 */
describe("memory/RUBRIC.md", () => {
  const doc = readFileSync("memory/RUBRIC.md", "utf8");

  it("heads itself with the version the code scores with", () => {
    expect(doc).toContain(`**Version: ${RUBRIC_VERSION}**`);
  });

  it("logs that version in its change table", () => {
    expect(doc).toContain(`| ${RUBRIC_VERSION} |`);
  });
});
