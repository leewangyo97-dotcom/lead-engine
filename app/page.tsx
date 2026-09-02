import { getInbox, getJudgedCount, tierOf } from "@/lib/leads/queries";
import { getPipelineFaults } from "@/lib/leads/health-query";
import { getInboxStats } from "@/lib/leads/stats";
import { Shell } from "./components/shell";
import { StatTiles } from "./components/stat-tiles";
import { InboxList } from "./components/inbox-list";

// Triage state changes on every keystroke, so nothing here may be cached.
export const dynamic = "force-dynamic";

/** Figma 3:853 — Today / This week / All, with the tab underlined in ember. */
const TABS = [
  { key: "today", label: "Today", days: 1 },
  { key: "week", label: "This week", days: 7 },
  { key: "all", label: "All", days: null },
] as const;

function relativeTime(d: Date | null): string {
  if (!d) return "never";
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default async function Inbox({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const active = TABS.find((t) => t.key === tab) ?? TABS[2];

  const [all, faults, stats] = await Promise.all([
    getInbox(),
    getPipelineFaults(),
    getInboxStats(),
  ]);

  // Filtering here rather than in SQL: the triage list is capped by the
  // pre-filter at a couple of dozen rows, so a second query would cost a round
  // trip to save nothing.
  const cutoff = active.days == null ? null : Date.now() - active.days * 86_400_000;
  const rows = cutoff == null ? all : all.filter((r) => (r.postedAt?.getTime() ?? 0) >= cutoff);

  const judged = rows.length === 0 ? await getJudgedCount() : 0;
  const counts = rows.reduce(
    (acc, r) => {
      acc[(r.tier as "live" | "warn" | "cold" | null) ?? tierOf(r.score)] += 1;
      return acc;
    },
    { live: 0, warn: 0, cold: 0 },
  );

  return (
    <Shell current="/">
      <div className="mx-auto max-w-content">
        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <h1
            className="font-display text-heading-lg text-primary"
            style={{ fontVariationSettings: "'opsz' 24, 'SOFT' 25, 'WONK' 0" }}
          >
            Inbox
          </h1>
          <p className="text-body-sm text-muted">Last run: {relativeTime(stats.lastRunAt)}</p>
        </header>

        <div className="mt-5">
          <StatTiles stats={stats} />
        </div>

        {faults.length > 0 && (
          <div
            role="alert"
            className="mt-5 rounded-md border border-stop bg-stop-tint p-5 text-body-sm text-primary"
          >
            <p className="mb-2 text-label uppercase text-stop">Pipeline fault</p>
            <ul className="list-disc pl-5">
              {faults.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <p className="mt-3 text-caption text-muted">
              Usually a transient upstream error, and the next run recovers on its own — the content
              hash re-collects anything missed. It needs attention if the same source fails three
              nights running. See <code className="font-mono text-data">docs/08-RUNBOOK.md</code>.
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-rule">
          <nav aria-label="Time range" className="flex gap-6">
            {TABS.map((t) => (
              <a
                key={t.key}
                href={t.key === "all" ? "/" : `/?tab=${t.key}`}
                aria-current={t.key === active.key ? "page" : undefined}
                className={`-mb-px border-b-2 pb-2 text-body-sm transition-colors ${
                  t.key === active.key
                    ? "border-accent text-primary"
                    : "border-transparent text-muted hover:text-secondary"
                }`}
              >
                {t.label}
              </a>
            ))}
          </nav>

          <p className="flex items-center gap-2 pb-2 text-caption text-faint">
            Navigate
            <kbd className="rounded-xs border border-rule bg-sunk px-2 py-0.5 font-mono text-data-sm">
              J
            </kbd>
            <kbd className="rounded-xs border border-rule bg-sunk px-2 py-0.5 font-mono text-data-sm">
              K
            </kbd>
          </p>
        </div>

        <p className="mt-4 flex gap-4 font-mono text-data-sm tabular-nums text-muted">
          <span className="text-go">Live {counts.live}</span>
          <span className="text-hold">Reachable {counts.warn}</span>
          <span>Long shot {counts.cold}</span>
        </p>

        <div className="mt-4">
          <InboxList rows={rows} judged={judged} />
        </div>

        <p className="mt-5 text-caption text-faint">
          Press{" "}
          <kbd className="rounded-xs border border-rule bg-sunk px-2 py-0.5 font-mono text-data-sm">
            Enter
          </kbd>{" "}
          to open the selected lead ·{" "}
          <kbd className="rounded-xs border border-rule bg-sunk px-2 py-0.5 font-mono text-data-sm">
            ?
          </kbd>{" "}
          for all shortcuts
        </p>
      </div>
    </Shell>
  );
}
