import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { sources } from "@/lib/db/schema";
import { NEEDS_DRAFT_THRESHOLD, RUBRIC_VERSION } from "@/lib/scoring/prescore";
import { CONTACT_COOLDOWN_DAYS, MAX_AGE_DAYS } from "@/lib/scoring/disqualify";
import { PRUNE_STATUSES, RETAIN_DAYS } from "@/lib/retention";

export const dynamic = "force-dynamic";

/**
 * Read-only for now, and honestly labelled as such.
 *
 * The spec asks for weight sliders live-previewed against last night's leads.
 * That is worth building, but the weights live in memory/RUBRIC.md, which is a
 * file in the repo rather than a table — editing it from a web form means either
 * a write path into the working tree or a second source of truth. Both are
 * decisions to make deliberately in Phase 6, when the learning loop needs to
 * propose weight changes anyway.
 */
export default async function Settings() {
  const db = getDb();
  const rows = await db.select().from(sources).orderBy(desc(sources.lastRunAt));

  return (
    <main className="mx-auto max-w-content px-6 py-8">
      <a className="text-body-sm text-accent underline underline-offset-2" href="/">
        ← inbox
      </a>

      <h1
        className="mt-4 font-display text-heading-lg text-primary"
        style={{ fontVariationSettings: "'opsz' 24, 'SOFT' 25, 'WONK' 0" }}
      >
        Settings
      </h1>

      <section className="mt-8">
        <h2 className="mb-5 text-label uppercase text-muted">Sources</h2>
        <ul className="max-w-prose">
          {rows.map((s) => (
            <li key={s.id} className="flex items-baseline justify-between border-b border-rule-soft py-3">
              <span className="text-body text-primary">{s.label}</span>
              <span className={`font-mono text-data-sm ${s.lastOk ? "text-go" : "text-stop"}`}>
                {s.lastOk ? "ok" : "failed"} · {s.lastRunAt?.toISOString().slice(0, 16).replace("T", " ") ?? "never"}
              </span>
            </li>
          ))}
          {!rows.length && <li className="py-3 text-body text-muted">No source has run yet.</li>}
        </ul>
      </section>

      <section className="mt-9">
        <h2 className="mb-5 text-label uppercase text-muted">Thresholds</h2>
        <dl className="max-w-prose text-body-sm">
          {[
            ["Rubric version", RUBRIC_VERSION],
            ["Draft threshold", String(NEEDS_DRAFT_THRESHOLD)],
            ["Max posting age", `${MAX_AGE_DAYS} days`],
            ["Contact cooldown", `${CONTACT_COOLDOWN_DAYS} days`],
            ["Retention", `${RETAIN_DAYS} days, for ${PRUNE_STATUSES.join(", ")}`],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between border-b border-rule-soft py-3">
              <dt className="text-secondary">{label}</dt>
              <dd className="font-mono tabular-nums text-primary">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="mt-7 max-w-prose text-caption text-faint">
        These values are read from the code, not from a database, so this page cannot drift from what
        the pipeline actually does. Editing them means editing{" "}
        <code className="font-mono text-data">memory/RUBRIC.md</code> and the modules that read it —
        weight sliders arrive in Phase 6, when the learning loop starts proposing changes.
      </p>
    </main>
  );
}
