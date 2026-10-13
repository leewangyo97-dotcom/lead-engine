import { spawnSync } from "node:child_process";
import {
  contentScore,
  parseSpamReport,
  spamSamples,
  TEST_ARTIFACTS,
  toEml,
} from "../lib/places/spam-check";

/**
 * Scores every kind of email the app writes with SpamAssassin, before any is sent.
 *
 *   pnpm spam:check
 *
 * Needs Docker. The first run builds `tools/spamassassin` (about a minute), and
 * later runs reuse the image. Local rules only (-L): nothing leaves the machine.
 *
 * SpamAssassin files mail as spam at 5 points. This fails at FAIL_AT, well short
 * of that, because Gmail weighs much that SpamAssassin cannot see: the sender's
 * reputation, and whether people reply. The words should leave all the room for
 * those.
 */
const IMAGE = "lead-engine-spamassassin";
const FAIL_AT = 2.5;

function docker(args: string[], input?: string) {
  return spawnSync("docker", args, { input, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
}

function main() {
  if (docker(["info"]).status !== 0) {
    console.error("spam:check: Docker is not running. Start Docker Desktop and try again.");
    process.exit(1);
  }
  if (docker(["image", "inspect", IMAGE]).status !== 0) {
    console.log("spam:check: building the SpamAssassin image (first run only)…");
    const built = spawnSync("docker", ["build", "-t", IMAGE, "tools/spamassassin"], { stdio: "inherit" });
    if (built.status !== 0) process.exit(1);
  }

  let worst = 0;
  for (const { label, email } of spamSamples()) {
    const run = docker(["run", "--rm", "-i", IMAGE], toEml(email));
    const verdict = parseSpamReport(run.stdout ?? "");
    if (!verdict) {
      console.error(`spam:check: no verdict for "${label}"\n${(run.stderr ?? "").slice(0, 400)}`);
      process.exit(1);
    }
    const score = contentScore(verdict);
    worst = Math.max(worst, score);
    const hits = verdict.rules
      .filter((r) => r.points !== 0 && !(r.name in TEST_ARTIFACTS))
      .map((r) => `${r.name} ${r.points > 0 ? "+" : ""}${r.points}`)
      .join(", ");
    const mark = score >= FAIL_AT ? "FAIL" : "ok  ";
    console.log(`${mark} ${score.toFixed(1).padStart(4)}  ${label.padEnd(15)} ${hits || "no rules with points"}`);
  }

  console.log(`\nworst ${worst.toFixed(1)} of ${FAIL_AT} allowed (SpamAssassin files as spam at 5.0)`);
  for (const [rule, why] of Object.entries(TEST_ARTIFACTS)) {
    console.log(`not counted: ${rule}, because ${why}`);
  }
  if (worst >= FAIL_AT) process.exit(1);
}

main();
