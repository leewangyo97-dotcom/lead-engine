import { execFile } from "node:child_process";
import { neon } from "@neondatabase/serverless";
import { loadLocalEnv } from "../lib/env";

/**
 * Proves every checked-in migration applies to an empty database.
 *
 * The definition of done requires it, and it has been done three times by hand
 * because there was no script — while `shipper` documented `pnpm db:migrate:check`
 * as though there were, so that agent would have failed at its own gate.
 *
 * A Neon branch is a copy of production, so it starts with every table already
 * present. Testing against one unmodified proves nothing; this empties it first.
 * That is destructive, which is why it refuses to touch DATABASE_URL:
 *
 *   neon branches create --name migrate-check --project-id <id>
 *   MIGRATION_CHECK_DATABASE_URL=$(neon connection-string migrate-check \
 *     --project-id <id> --pooled --database-name neondb) pnpm db:migrate:check
 *   neon branches delete migrate-check --project-id <id>
 */
const EXPECTED_TABLES = [
  "events",
  "leads",
  "outreach",
  "prospects",
  "run_metrics",
  "runs",
  "scores",
  "searches",
  "sources",
  "suppressions",
];

function runMigrate(url: string): Promise<number> {
  return new Promise((resolve) => {
    execFile(
      "node",
      ["--import", "tsx", "scripts/migrate.ts"],
      { env: { ...process.env, DATABASE_URL: url } },
      (err, stdout, stderr) => {
        process.stdout.write(stdout);
        if (err) process.stderr.write(stderr);
        resolve(err ? 1 : 0);
      },
    );
  });
}

async function main() {
  loadLocalEnv();
  const url = process.env.MIGRATION_CHECK_DATABASE_URL;

  if (!url) {
    console.error("MIGRATION_CHECK_DATABASE_URL is not set — see the header comment.");
    process.exit(1);
  }
  if (url === process.env.DATABASE_URL) {
    console.error("refusing: that is the database in DATABASE_URL, and this drops its schema.");
    process.exit(1);
  }

  const sql = neon(url);
  await sql`drop schema public cascade`;
  await sql`create schema public`;
  await sql`drop schema if exists drizzle cascade`;

  const [{ n: before }] = (await sql`
    select count(*)::int n from information_schema.tables where table_schema = 'public'
  `) as { n: number }[];
  console.log(`emptied: ${before} tables`);

  if ((await runMigrate(url)) !== 0) {
    console.error("migrations failed to apply to an empty database");
    process.exit(1);
  }

  const rows = (await sql`
    select table_name from information_schema.tables where table_schema = 'public' order by 1
  `) as { table_name: string }[];
  const found = rows.map((r) => r.table_name);
  const missing = EXPECTED_TABLES.filter((t) => !found.includes(t));

  console.log(`after: ${found.join(", ")}`);

  if (missing.length) {
    console.error(`missing after migration: ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log("db:migrate:check: every migration applies to a fresh database");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
