import { MIN_SENDS, MIN_TOTAL_FOR_SUGGESTION, buildRollup, type Cut } from "@/lib/review/rollup";
import { getScoreDistribution, type Band } from "@/lib/review/distribution";

import { Shell } from "@/app/components/shell";

export const dynamic = "force-dynamic";

function CutTable({ title, cuts }: { title: string; cuts: Cut[] }) {
  if (!cuts.length) return null;
  return (
    <section className="mb-9">
      <h2 className="mb-5 text-label uppercase text-muted">{title}</h2>
      <table className="w-full max-w-prose text-body-sm">
        <tbody>
          {cuts.map((c) => (
            <tr key={c.key} className="border-b border-rule-soft">
              <td className="py-3 text-secondary">{c.key}</td>
              <td className="py-3 text-right font-mono tabular-nums text-primary">
                {c.replies}/{c.sends}
              </td>
              <td className="w-[96px] py-3 text-right font-mono tabular-nums">
                {c.replyRate == null ? (
                  <span className="text-faint">—</span>
                ) : (
                  <span className="text-primary">{Math.round(c.replyRate * 100)}%</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/**
 * Figma's Score Distribution card (3:1694): five bands, a bar each, the count
 * on the right.
 *
 * It answers a question the outcome tables cannot. They only see leads that
 * were sent something, so a scorer that has collapsed into one band — every
 * lead a 55, nothing ever clearing the threshold — looks like silence rather
 * than a fault.
 */
function ScoreDistribution({ bands }: { bands: Band[] }) {
  const total = bands.reduce((n, b) => n + b.count, 0);
  return (
    <section className="mb-9">
      <h2 className="mb-5 text-label uppercase text-muted">Score distribution</h2>
      {total === 0 ? (
        <p className="max-w-prose text-body-sm text-muted">No lead has been scored yet.</p>
      ) : (
        <ul className="max-w-prose">
          {bands.map((band) => (
            <li key={band.label} className="flex items-center gap-4 py-2">
              <span className="w-[60px] shrink-0 font-mono text-data-sm tabular-nums text-secondary">
                {band.label}
              </span>
              <span className="h-4 flex-1 overflow-hidden rounded-xs bg-sunk">
                <span
                  className="block h-4 rounded-xs bg-accent"
                  style={{ width: `${band.width}%` }}
                />
              </span>
              <span className="w-[40px] shrink-0 text-right font-mono text-data-sm tabular-nums text-primary">
                {band.count}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 max-w-prose text-caption text-faint">
        Every lead ever scored, by its most recent score. Bars are relative to the largest band, so
        the shape is the spread and the figure is the count.
      </p>
    </section>
  );
}

export default async function Review() {
  const rollup = await buildRollup();
  const bands = await getScoreDistribution();

  return (
    <Shell current="/review">
      <div className="mx-auto max-w-content">

      <h1
        className="mt-4 font-display text-heading-lg text-primary"
        style={{ fontVariationSettings: "'opsz' 24, 'SOFT' 25, 'WONK' 0" }}
      >
        Weekly review
      </h1>
      {/* Figma 3:1662 dates the review "Aug 25 - Sep 1". This one is not
          windowed: with five sends in total, a seven-day window would show an
          empty page most weeks and hide the only evidence there is. Saying so
          beats printing a range the numbers do not obey. */}
      <p className="mt-2 text-body text-secondary">
        {rollup.totalReplies} replies from {rollup.totalSends} sends, all time.
      </p>

      {rollup.suggestion ? (
        <div className="mt-7 max-w-prose rounded-md border border-accent bg-accent-tint p-6">
          <p className="text-body text-primary">{rollup.suggestion}</p>
        </div>
      ) : (
        /*
         * Say which condition is actually unmet.
         *
         * This used to print one sentence whatever the reason, and the moment
         * sends passed the threshold it started blaming the wrong thing: "it
         * needs 20 logged sends — currently 23" reads as a counting problem
         * that has already been solved. With 23 sends and no replies at all,
         * nothing is being withheld for want of data volume; there is simply no
         * difference between groups until something comes back.
         */
        <p className="mt-7 max-w-prose rounded-md border border-rule bg-surface p-6 text-body text-muted">
          {rollup.totalSends < MIN_TOTAL_FOR_SUGGESTION ? (
            <>
              No suggestion yet. It needs {MIN_TOTAL_FOR_SUGGESTION} logged sends and a gap wide
              enough to be a finding rather than two small samples disagreeing — currently{" "}
              {rollup.totalSends}.
            </>
          ) : rollup.totalReplies === 0 ? (
            <>
              No suggestion yet, and it is not for want of sends — there are {rollup.totalSends}.
              Nothing has replied, so every cut below reads zero and there is no difference between
              them to report. The first reply is what unblocks this.
            </>
          ) : (
            <>
              No suggestion yet. There are {rollup.totalSends} sends and {rollup.totalReplies}{" "}
              replies, but no gap wide enough to be a finding rather than two small samples
              disagreeing.
            </>
          )}
        </p>
      )}

      <div className="mt-9">
        <ScoreDistribution bands={bands} />
        <CutTable title="By angle" cuts={rollup.byAngle} />
        <CutTable title="By source" cuts={rollup.bySource} />
        <CutTable title="By stack" cuts={rollup.byStack} />
        <CutTable title="By send day" cuts={rollup.bySendDay} />
      </div>

      <p className="max-w-prose text-caption text-faint">
        A rate is withheld below {MIN_SENDS} sends. Two replies in three is 67% and means nothing —
        showing it would make noise look like a finding. Nothing on this page is ever applied
        automatically.
      </p>
      </div>
    </Shell>
  );
}
