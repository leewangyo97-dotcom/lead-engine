import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { sources } from "@/lib/db/schema";
import { NEEDS_DRAFT_THRESHOLD, RUBRIC_VERSION } from "@/lib/scoring/prescore";
import { CONTACT_COOLDOWN_DAYS, MAX_AGE_DAYS } from "@/lib/scoring/disqualify";
import { PRUNE_STATUSES, RETAIN_DAYS } from "@/lib/retention";
import { checkGmail, type GmailState, type GmailStatus } from "@/lib/gmail/status";

import { Shell } from "@/app/components/shell";

export const dynamic = "force-dynamic";

/**
 * Read-only for now, and honestly labelled as such.
 *
 * docs/04-UI-SPEC.md asks for weight sliders live-previewed against last night's
 * leads. They are not here, and that is a standing decision rather than an
 * omission: the weights live in memory/RUBRIC.md, a file in the repo, so editing
 * them from a web form needs either a write path into the working tree or a
 * second source of truth that can disagree with the first.
 *
 * Until that is settled, tuning a weight is a commit — which is reviewable, and
 * which RUBRIC.md's own tuning log already requires.
 */
export default async function Settings() {
  const db = getDb();
  const rows = await db.select().from(sources).orderBy(desc(sources.lastRunAt));
  // Awaited with the page rather than streamed behind a Suspense boundary. A
  // boundary here means a second flush, and a second flush is a thing that can
  // fail to arrive — in the preview browser it does not, and the page sits on
  // its skeleton for ever. One flush costs ~300ms on a page opened rarely, and
  // it is the answer the page is opened for.
  const gmail = await checkGmail();

  return (
    <Shell current="/settings">
      <div className="mx-auto max-w-content">

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
                {s.lastOk ? "ok" : "failed"} · {s.lastRawCount ?? "?"} raw ·{" "}
                {s.lastRunAt?.toISOString().slice(0, 16).replace("T", " ") ?? "never"}
              </span>
            </li>
          ))}
          {!rows.length && <li className="py-3 text-body text-muted">No source has run yet.</li>}
        </ul>
      </section>

      {/* Figma 3:1572 — a Gmail card carrying the account and its state. The
          app had no way to learn the refresh token had expired except to run
          `pnpm gmail:drafts` and watch it fail, and while the consent screen is
          in Testing that happens every seven days. */}
      <section className="mt-9">
        <h2 className="mb-5 text-label uppercase text-muted">Gmail</h2>
        <GmailCard status={gmail} />
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
        These values are read from the code, not from a database, so this page cannot drift from
        what the pipeline actually does. Changing one means editing{" "}
        <code className="font-mono text-data">memory/RUBRIC.md</code> and the module that reads it,
        then bumping the rubric version so old scores stay interpretable. That is deliberate: a
        weight change is a commit someone can review, which is what the tuning log asks for.
      </p>
      </div>
    </Shell>
  );
}

const GMAIL_TONE: Record<GmailState, string> = {
  connected: "text-go",
  expired: "text-hold",
  unconfigured: "text-muted",
  error: "text-stop",
};

const GMAIL_LABEL: Record<GmailState, string> = {
  connected: "connected",
  expired: "expired",
  unconfigured: "not authorised",
  error: "failing",
};

/**
 * Not cached: a "connected" from an hour ago answers a question nobody asked.
 * What is wanted is whether a draft can be written now.
 */
function GmailCard({ status }: { status: GmailStatus }) {
  return (
    <div className="max-w-prose rounded-md border border-rule bg-surface p-5">
      <p className="flex items-baseline gap-3">
        <span className={`font-mono text-data-sm ${GMAIL_TONE[status.state]}`}>
          {GMAIL_LABEL[status.state]}
        </span>
        <span className="text-body-sm text-secondary">
          scope <code className="font-mono text-data">gmail.compose</code> — drafts only, no send
          path and no access to the mailbox
        </span>
      </p>
      <p className="mt-3 text-body-sm text-muted">{status.message}</p>
    </div>
  );
}
