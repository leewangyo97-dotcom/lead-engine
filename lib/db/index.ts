import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// HTTP driver, not the WebSocket pool: Neon autosuspends at 5 min idle and
// cannot be told not to, so a held connection buys nothing and costs CU-hours.
export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return drizzle(neon(url), { schema });
}

export { schema };
