import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Phase 0 only. The full schema lands in Phase 1 from docs/03-DATA-MODEL.md.
 *
 * `runs` exists now because Phase 3's keepalive step needs a row to touch:
 * GitHub disables scheduled workflows after 60 days of repo inactivity.
 */
export const runs = pgTable("runs", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  note: text("note"),
});

export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
