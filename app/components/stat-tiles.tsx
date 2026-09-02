import type { InboxStats } from "@/lib/leads/stats";

/**
 * The metrics row from Figma 3:823 — five tiles in one bordered box, separated
 * by hairline rules rather than gaps.
 *
 * The captions are the design's own words. They are not decoration: "since
 * Monday" and "this week" are what make the numbers legible, and a bare 34 next
 * to a bare 8 invites the reader to compare two different periods.
 */
export function StatTiles({ stats }: { stats: InboxStats }) {
  const tiles: [string, string, string][] = [
    ["Harvested", String(stats.harvested), "since Monday"],
    ["Drafted", String(stats.drafted), "pending review"],
    ["Sent", String(stats.sent), "this week"],
    ["Replied", String(stats.replied), "leads engaged"],
    ["Score avg", stats.scoreAvg == null ? "--" : String(stats.scoreAvg), "quality threshold"],
  ];

  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-md border border-rule bg-surface sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map(([label, value, caption], i) => (
        <div
          key={label}
          className={`px-5 py-4 ${i > 0 ? "border-rule lg:border-l" : ""} ${
            i % 2 === 1 ? "border-l border-rule lg:border-l" : ""
          }`}
        >
          <p className="text-label uppercase text-muted">{label}</p>
          <p className="mt-1 font-mono text-data-lg tabular-nums text-primary">{value}</p>
          <p className="mt-1 text-caption text-faint">{caption}</p>
        </div>
      ))}
    </div>
  );
}
