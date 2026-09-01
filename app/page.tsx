import { getInbox, tierOf } from "@/lib/leads/queries";
import { InboxList } from "./components/inbox-list";

// Triage state changes on every keystroke, so nothing here may be cached.
export const dynamic = "force-dynamic";

export default async function Inbox() {
  const rows = await getInbox();

  const counts = rows.reduce(
    (acc, r) => {
      const tier = (r.tier as "live" | "warn" | "cold" | null) ?? tierOf(r.score);
      acc[tier] += 1;
      return acc;
    },
    { live: 0, warn: 0, cold: 0 },
  );

  return (
    <main className="mx-auto max-w-content px-6 py-8">
      <header className="mb-7 flex flex-wrap items-baseline justify-between gap-4 border-b border-rule pb-5">
        <h1
          className="font-display text-heading-lg text-primary"
          style={{ fontVariationSettings: "'opsz' 24, 'SOFT' 25, 'WONK' 0" }}
        >
          Today · {rows.length} to triage
        </h1>
        <div className="flex gap-4 font-mono text-data-sm tabular-nums text-muted">
          <span className="text-go">Live {counts.live}</span>
          <span className="text-hold">Reachable {counts.warn}</span>
          <span>Long shot {counts.cold}</span>
        </div>
      </header>

      <InboxList rows={rows} />

      <p className="mt-7 text-caption text-faint">
        <kbd className="rounded-xs bg-sunk px-2 py-1 font-mono text-data-sm">?</kbd> for shortcuts ·{" "}
        <a className="text-accent underline underline-offset-2" href="/settings">
          settings
        </a>
      </p>
    </main>
  );
}
