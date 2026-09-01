import { MIN_SENDS, MIN_TOTAL_FOR_SUGGESTION, buildRollup, type Cut } from "@/lib/review/rollup";

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
              <td className="w-24 py-3 text-right font-mono tabular-nums">
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

export default async function Review() {
  const rollup = await buildRollup();

  return (
    <main className="mx-auto max-w-content px-6 py-8">
      <a className="text-body-sm text-accent underline underline-offset-2" href="/">
        ← inbox
      </a>

      <h1
        className="mt-4 font-display text-heading-lg text-primary"
        style={{ fontVariationSettings: "'opsz' 24, 'SOFT' 25, 'WONK' 0" }}
      >
        Weekly review
      </h1>
      <p className="mt-2 text-body text-secondary">
        {rollup.totalReplies} replies from {rollup.totalSends} sends.
      </p>

      {rollup.suggestion ? (
        <div className="mt-7 max-w-prose rounded-md border border-accent bg-accent-tint p-6">
          <p className="text-body text-primary">{rollup.suggestion}</p>
        </div>
      ) : (
        <p className="mt-7 max-w-prose rounded-md border border-rule bg-surface p-6 text-body text-muted">
          No suggestion yet. It needs {MIN_TOTAL_FOR_SUGGESTION} logged sends and a gap wide enough
          to be a finding rather than two small samples disagreeing — currently {rollup.totalSends}.
        </p>
      )}

      <div className="mt-9">
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
    </main>
  );
}
