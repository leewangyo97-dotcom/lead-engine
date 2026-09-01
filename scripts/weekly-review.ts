import { loadLocalEnv } from "../lib/env";
import { MIN_SENDS, MIN_TOTAL_FOR_SUGGESTION, buildRollup } from "../lib/review/rollup";

/**
 * The weekly rollup on the command line, for the Friday review.
 *
 * It prints a suggestion at most. It never edits `memory/RUBRIC.md`, and it never
 * writes to `memory/DECISIONS.md` — accepting is a human act, and a loop that
 * tunes itself is a loop nobody can audit six weeks later when the reply rate
 * has quietly halved.
 */
function line(label: string, cuts: { key: string; sends: number; replies: number; replyRate: number | null }[]) {
  if (!cuts.length) return;
  console.log(`\n${label}`);
  for (const c of cuts) {
    const rate = c.replyRate == null ? "  —" : `${String(Math.round(c.replyRate * 100)).padStart(3)}%`;
    console.log(`  ${c.key.padEnd(22)} ${String(c.replies).padStart(3)}/${String(c.sends).padEnd(3)} ${rate}`);
  }
}

async function main() {
  loadLocalEnv();
  const rollup = await buildRollup();

  console.log(`weekly review: ${rollup.totalReplies} replies from ${rollup.totalSends} sends`);

  if (!rollup.totalSends) {
    console.log("\nNothing sent yet. Log a send on a lead detail page to start the loop.");
    return;
  }

  line("by angle", rollup.byAngle);
  line("by source", rollup.bySource);
  line("by stack", rollup.byStack);
  line("by send day", rollup.bySendDay);

  console.log(
    `\nRates are withheld below ${MIN_SENDS} sends — a rate over three sends is noise wearing a number.`,
  );

  if (rollup.suggestion) {
    console.log(`\nSUGGESTION\n  ${rollup.suggestion}`);
  } else {
    console.log(
      `\nNo suggestion: needs ${MIN_TOTAL_FOR_SUGGESTION} sends and a gap of 15 points or more between angles.`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
