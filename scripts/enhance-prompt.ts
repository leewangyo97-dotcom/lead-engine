import { eq } from "drizzle-orm";
import { getDb } from "../lib/db";
import { prospects } from "../lib/db/schema";
import { loadLocalEnv } from "../lib/env";
import { buildEnhancePrompt } from "../lib/places/enhance";

/**
 * Prints the enhance prompt for one prospect.
 *
 *   pnpm -s enhance:prompt --id=<prospect id>
 *
 * The enhance workflow's first step. It is the same prompt the panel's
 * "Copy prompt" hands out, so the button and the terminal produce one message.
 */
async function main() {
  loadLocalEnv();
  const id = process.argv.find((a) => a.startsWith("--id="))?.slice("--id=".length) ?? "";
  if (!/^[a-z0-9]{8,40}$/.test(id)) {
    console.error("enhance:prompt: --id=<prospect id> is required");
    process.exit(1);
  }

  const [place] = await getDb().select().from(prospects).where(eq(prospects.id, id)).limit(1);
  if (!place) {
    console.error(`enhance:prompt: no prospect ${id}`);
    process.exit(1);
  }
  process.stdout.write(buildEnhancePrompt([place]));
}

main().catch((err) => {
  console.error("enhance:prompt:", err instanceof Error ? err.message : err);
  process.exit(1);
});
