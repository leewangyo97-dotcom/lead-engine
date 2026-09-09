import { getInbox, getJudgedCount, tierOf } from "@/lib/leads/queries";
import { getPipelineFaults } from "@/lib/leads/health-query";
import { getInboxStats } from "@/lib/leads/stats";
import { getAwaitingSend } from "@/lib/leads/awaiting-send";
import { Shell } from "./components/shell";
import { StatTiles } from "./components/stat-tiles";
import { InboxList } from "./components/inbox-list";
import { EmptyInbox } from "./components/empty-inbox";

// Triage state changes on every keystroke, so nothing here may be cached.
export const dynamic = "force-dynamic";

/** Figma 3:853 — Today / This week / All, with the tab underlined in ember. */
const TABS = [
  { key: "today", label: "Today", days: 1 },
  { key: "week", label: "This week", days: 7 },
  { key: "all", label: "All", days: null },
] as const;

/**
 * When the nightly run fires next, in the reader's terms.
 *
 * The cron is 20:17 UTC Monday to Friday, which is just after 04:00 the next
 * morning in Manila. On a Friday evening the next run is Monday, and saying
 * "tomorrow" then would simply be wrong.
 */
function nextRunPhrase(now = new Date()): string {
  const day = now.getUTCDay();
  const ranToday = now.getUTCHours() >= 20;

  // The weekend gap. Monday's 20:17 UTC run lands at 04:17 Tuesday in Manila,
  // so "Monday" would be a day early — the offset is the whole point of saying
  // it in Manila time at all.
  const weekendAhead = day === 6 || day === 0 || (day === 5 && ranToday);
  if (weekendAhead) return "Tuesday at 4am";

  // Otherwise it is always the next Manila morning, whether tonight's run has
  // fired yet or not: before 20:17 UTC it fires tonight, after it fires
  // tomorrow night — both land at 4am on the following Manila day.
  return "tomorrow at 4am";
}

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

  const [all, faults, stats, awaiting] = await Promise.all([
    getInbox(),
    getPipelineFaults(),
    getInboxStats(),
    getAwaitingSend(),
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

        {awaiting.length > 0 && (
          /* The one queue with a deadline. A draft in Gmail was invisible here
             until now, so an application could sit unsent for a week while every
             screen reported nothing outstanding. */
          <section
            aria-label="Drafts awaiting send"
            className="mt-5 rounded-md border border-rule bg-surface p-5"
          >
            <p className="text-label uppercase text-muted">
              {awaiting.length} draft{awaiting.length === 1 ? "" : "s"} waiting in Gmail
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {awaiting.map((d) => (
                <li key={d.leadId} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <a
                    href={`/lead/${d.leadId}`}
                    className="text-body-sm text-primary underline underline-offset-2"
                  >
                    {d.company}
                  </a>
                  <span className="text-body-sm text-muted">{d.title}</span>
                  <span
                    title={
                      d.age === "cold"
                        ? "The posting has probably closed — worth checking before sending"
                        : d.age === "stale"
                          ? "Going cold: postings fill and threads get buried"
                          : "Written recently"
                    }
                    className={`font-mono text-data-sm tabular-nums ${
                      d.age === "cold"
                        ? "text-stop"
                        : d.age === "stale"
                          ? "text-hold"
                          : "text-faint"
                    }`}
                  >
                    {d.ageDays === 0 ? "today" : `${d.ageDays}d old`}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-caption text-faint">
              Read each one in Gmail, send it, then mark it sent on the lead so the follow-up
              ladder starts.
            </p>
          </section>
        )}

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
          {rows.length === 0 ? (
            <EmptyInbox
              judged={judged}
              harvested={stats.harvested}
              drafted={stats.drafted}
              nextRun={nextRunPhrase()}
            />
          ) : (
            <InboxList rows={rows} judged={judged} />
          )}
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
