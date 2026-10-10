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

  // Separate cards on a gap, after the reference's KPI row: each one a figure
  // you can read without the others.
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map(([label, value, caption]) => (
        <div key={label} className="rounded-lg border border-rule bg-surface p-5">
          <p className="text-body-sm font-medium text-secondary">{label}</p>
          <p className="mt-3 text-display-lg tabular-nums text-primary">{value}</p>
          <p className="mt-1 text-caption text-muted">{caption}</p>
        </div>
      ))}
    </div>
  );
}
