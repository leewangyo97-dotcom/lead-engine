import { execFileSync } from "node:child_process";
import { loadLocalEnv } from "../lib/env";
import { judgeBudget, sizeOf, type PayloadSize } from "../lib/model/estimate";

/**
 * What tonight's model calls would cost, measured from the payloads themselves.
 *
 * `pnpm tokens` reports what a run actually cost, and cannot say anything until
 * someone records it by hand from the session that made the calls. Every run so
 * far reads "(not measured)", so the ceiling in `docs/05-TOKEN-BUDGET.md` has
 * never been checked against anything.
 *
 * This checks the half that can be checked without a model: the payloads are
 * built by deterministic code, so their size is knowable now. It runs the real
 * emitters rather than reimplementing their queries — a copy of a query is a
 * second thing to keep in step, and it would report the budget of code nobody
 * runs.
 *
 * The output is an estimate and says so. Its job is to catch a payload that has
 * grown several times over, which is what a broken filter looks like.
 */
const TARGET = 25_000;
const CEILING = 40_000;

/** The three emitters a /daily-run pipes into a model, in the order it runs them. */
const EMITTERS = [
  { name: "scoring", script: "scripts/leads-for-scoring.ts", rowsAt: "count" },
  { name: "drafting", script: "scripts/leads-for-drafting.ts", rowsAt: "count" },
  { name: "follow-ups", script: "scripts/followups-due.ts", rowsAt: "count" },
  // Prose rather than JSON, and part of the same nightly spend.
  { name: "enhance", script: "scripts/prospects-for-enhance.ts", rowsAt: "count" },
] as const;

/** Null when the payload is prose, which two of these emitters produce. */
function rowCount(payload: string, key: string): number | null {
  try {
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    const value = parsed[key];
    if (typeof value === "number") return value;
    // Not every emitter carries a count field; falling back to the longest
    // array in the payload is better than reporting zero rows for a payload
    // that plainly has some.
    const longest = Object.values(parsed)
      .filter(Array.isArray)
      .reduce((n, arr) => Math.max(n, arr.length), 0);
    return longest;
  } catch {
    return null;
  }
}

function main() {
  loadLocalEnv();

  const sizes: PayloadSize[] = [];
  for (const emitter of EMITTERS) {
    let payload: string;
    try {
      // node with the tsx loader rather than `npx tsx`: on Windows the npx
      // shim is npx.cmd and execFileSync does not find a bare "npx".
      payload = execFileSync(process.execPath, ["--import", "tsx", emitter.script], {
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      // An emitter that refuses to run is the pre-filter ceiling doing its job,
      // and reporting a low estimate because a payload failed to build would be
      // the exact opposite of what this script is for.
      const message = err instanceof Error ? err.message : String(err);
      console.error(`${emitter.name}: emitter failed, so no estimate is possible.\n${message}`);
      process.exit(1);
    }
    sizes.push(sizeOf(emitter.name, rowCount(payload, emitter.rowsAt), payload));
  }

  for (const size of sizes) {
    const rows = size.rows == null ? "prose" : String(size.rows);
    const perRow = size.rows ? ` (~${Math.round(size.estimatedTokens / size.rows)}/row)` : "";
    console.log(
      `${size.name.padEnd(11)} rows=${rows.padStart(5)} ` +
        `chars=${String(size.chars).padStart(7)} ~tokens=${String(size.estimatedTokens).padStart(6)}` +
        perRow,
    );
  }

  const total = sizes.reduce((n, s) => n + s.estimatedTokens, 0);
  const verdict = judgeBudget(total, TARGET, CEILING);

  console.log(`\n${verdict.message}`);
  console.log(
    "Input only, counted with a byte-pair tokeniser. Closer than the old four-" +
      "characters-per-token rule, which read 18% under on JSON — but still an " +
      "estimate: that tokeniser is OpenAI's and the model reading these is Claude. " +
      "Not a substitute for `pnpm tokens:record` after a real run.",
  );

  if (verdict.state === "over-ceiling") process.exit(1);
}

main();
