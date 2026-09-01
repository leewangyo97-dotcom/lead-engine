import { execFile } from "node:child_process";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "../lib/env";

/**
 * Exercises the write path that unit tests cannot reach: apply-drafts,
 * apply-verdicts, and the verified-only gate in front of Gmail.
 *
 * Run against a scratch Neon branch, never production:
 *
 *   neon branches create --name integration --project-id <id>
 *   INTEGRATION_DATABASE_URL=$(neon connection-string integration ...) pnpm test:integration
 *   neon branches delete integration --project-id <id>
 *
 * It spawns the real scripts rather than reimplementing them. A test that
 * duplicates the logic it is checking proves only that the duplicate works.
 *
 * The Gmail step is not run here — its own path is covered by `pnpm gmail:smoke`,
 * and this asserts the gate that decides whether it may run at all.
 */
loadLocalEnv();
const url = process.env.INTEGRATION_DATABASE_URL;
const productionUrl = process.env.DATABASE_URL;

function run(script: string, stdin?: string): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const child = execFile(
      "node",
      ["--import", "tsx", script],
      { env: { ...process.env, DATABASE_URL: url } },
      (err, stdout, stderr) => {
        resolve({ code: err ? 1 : 0, out: `${stdout}${stderr}`.trim() });
      },
    );
    if (stdin) child.stdin?.end(stdin);
    else child.stdin?.end();
  });
}

let failures = 0;
function check(label: string, condition: boolean, detail = "") {
  console.log(`${condition ? "  ok  " : " FAIL "} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failures += 1;
}

async function main() {
  if (!url) {
    console.error("INTEGRATION_DATABASE_URL is not set. Refusing to run — see the header comment.");
    process.exit(1);
  }
  const sql = neon(url);

  // This truncates tables, so the guard is the whole safety story.
  if (productionUrl && url === productionUrl) {
    console.error("refusing: INTEGRATION_DATABASE_URL is the same database as DATABASE_URL");
    process.exit(1);
  }

  // Row counts are not a usable signal here: a Neon branch is a copy of
  // production, so a legitimate scratch branch starts with every production row.
  // Two attempts at a size heuristic were wrong in opposite directions — one
  // waved production through because its outreach table was empty, the next
  // blocked every real branch. Identity is the check that actually holds.

  await sql`delete from events`;
  await sql`delete from scores`;
  await sql`delete from leads`;
  await sql`delete from sources`;
  await sql`insert into sources (id, label) values ('t', 'test')`;
  await sql`insert into leads (id, source_id, content_hash, company, title, contact, status)
            values ('L1', 't', 'h1', 'Acme', 'Android Engineer', 'dave@acme.io', 'needs_draft')`;

  console.log("apply-drafts");
  const draft = JSON.stringify({
    drafts: [
      {
        leadId: "L1",
        subject: "Kotlin contractor, available now",
        body: "body",
        angle: "crash-rate",
        proofUsed: ["crash rate -35%"],
      },
    ],
  });
  const wrote = await run("scripts/apply-drafts.ts", draft);
  check("writes the draft", wrote.code === 0, wrote.out.split("\n").pop());

  const [row] = (await sql`select verified_at, angle, proof_used from outreach where lead_id='L1'`) as {
    verified_at: string | null;
    angle: string;
    proof_used: string[];
  }[];
  check("leaves it unverified", row?.verified_at === null);
  check("persists angle and proof, which the learning loop needs", !!row?.angle && !!row?.proof_used);

  console.log("\nverified-only gate");
  const blocked = await run("scripts/create-gmail-drafts.ts");
  check(
    "refuses an unverified draft",
    blocked.out.includes("nothing verified and unsent"),
    blocked.out.split("\n").pop(),
  );

  console.log("\nrejects bad input");
  const badId = await run(
    "scripts/apply-drafts.ts",
    JSON.stringify({ drafts: [{ leadId: "nope", subject: "s", body: "b", angle: "a", proofUsed: ["p"] }] }),
  );
  check("refuses a lead not awaiting a draft", badId.code === 1);

  const badSchema = await run(
    "scripts/apply-verdicts.ts",
    JSON.stringify({ verdicts: [{ leadId: "L1", ok: true, violations: ["contradiction"] }] }),
  );
  check("refuses a verdict that passes while carrying violations", badSchema.code === 1);

  console.log("\napply-verdicts");
  const pass = await run(
    "scripts/apply-verdicts.ts",
    JSON.stringify({ verdicts: [{ leadId: "L1", ok: true, violations: [] }] }),
  );
  check("marks the draft verified", pass.code === 0, pass.out.split("\n").pop());

  const [after] = (await sql`select verified_at from outreach where lead_id='L1'`) as {
    verified_at: string | null;
  }[];
  check("verified_at is now set", after?.verified_at !== null);

  const events = (await sql`select type from events order by created_at`) as { type: string }[];
  check(
    "records draft_written and verify_passed",
    events.some((e) => e.type === "draft_written") && events.some((e) => e.type === "verify_passed"),
    events.map((e) => e.type).join(", "),
  );

  console.log(failures === 0 ? "\nintegration: all checks passed" : `\nintegration: ${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
