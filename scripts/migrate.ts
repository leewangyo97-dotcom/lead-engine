import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { requireDatabaseUrl } from "../lib/env";

// Migrations are forward-only and checked in. Never edit a shipped migration.
async function main() {
  const db = drizzle(neon(requireDatabaseUrl()));
  await migrate(db, { migrationsFolder: "./lib/db/migrations" });
  console.log("migrations applied");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
