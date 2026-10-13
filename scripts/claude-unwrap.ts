import { unwrapClaudeResult } from "../lib/model/unwrap";

/**
 * stdin: Claude Code's `--output-format json` envelope. stdout: the model's JSON.
 *
 *   pnpm -s claude:unwrap < answer.json | pnpm -s apply:enhance
 *
 * The step between the enhance workflow's Claude call and `apply:enhance`.
 */
async function main() {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  process.stdout.write(unwrapClaudeResult(Buffer.concat(chunks).toString("utf8")));
}

main().catch((err) => {
  console.error("claude:unwrap:", err instanceof Error ? err.message : err);
  process.exit(1);
});
