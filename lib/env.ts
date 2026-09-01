import { existsSync } from "node:fs";

/**
 * Loads .env.local for local script runs.
 *
 * Done in-process rather than with `tsx --env-file`, because tsx does not
 * forward that flag to the Node process it spawns — the variable silently never
 * arrives and the script fails claiming DATABASE_URL is unset. In CI there is no
 * file and the secret comes from the environment, so this is a no-op there.
 */
export function loadLocalEnv(): void {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
}

export function requireDatabaseUrl(): string {
  loadLocalEnv();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return url;
}
