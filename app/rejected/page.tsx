import {
  getRejected,
  getRejectedCount,
  getRejectedTally,
  REJECTED_PAGE_SIZE,
} from "@/lib/leads/rejected-query";
import { Pill } from "@/app/components/pills";

export const dynamic = "force-dynamic";

export default async function Rejected() {
  // The tally is counted in SQL over every rejected lead; only the list is
  // capped. Rendering all 187 rows to derive the counts made this page 757 KB.
  const [rows, summary, total] = await Promise.all([
    getRejected(),
    getRejectedTally(),
    getRejectedCount(),
  ]);

  return (
    <main className="mx-auto max-w-content px-6 py-8">
      <a className="text-body-sm text-accent underline underline-offset-2" href="/">
        &larr; inbox
      </a>

      <h1
        className="mt-4 font-display text-heading-lg text-primary"
        style={{ fontVariationSettings: "'opsz' 24, 'SOFT' 25, 'WONK' 0" }}
      >
        Turned away
      </h1>
      <p className="mt-2 max-w-prose text-body text-secondary">
        {total} lead(s) the filter rejected or parked, newest-scoring first. The inbox answers what
        to do today;
        this answers why there is nothing to do, which is the question worth asking when the funnel
        is dry.
      </p>

      <section className="mt-7">
        <h2 className="mb-4 text-label uppercase text-muted">By reason</h2>
        <ul className="flex flex-wrap gap-3">
          {summary.map((row) => (
            <li
              key={row.reason}
              className="rounded-sm border border-rule bg-surface px-4 py-2 text-body-sm"
            >
              <span className="text-secondary">{row.reason}</span>{" "}
              <span className="font-mono tabular-nums text-primary">{row.n}</span>
            </li>
          ))}
        </ul>
      </section>

      <ul className="mt-8 flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-md border border-rule bg-surface p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <a
                className="text-subhead text-primary underline-offset-4 hover:underline"
                href={`/lead/${row.id}`}
              >
                {row.company}
              </a>
              <span className="font-mono text-data-sm tabular-nums text-muted">
                {row.score ?? "--"} &middot; {row.sourceId}
              </span>
            </div>
            <p className="mt-1 text-body-sm text-secondary">{row.title}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Pill>{row.status}</Pill>
              {row.reason && <span className="text-caption text-faint">{row.reason}</span>}
            </div>
          </li>
        ))}
      </ul>

      {total > rows.length && (
        <p className="mt-5 text-caption text-faint">
          Showing the {REJECTED_PAGE_SIZE} highest-scoring of {total}. The counts above cover all of
          them — the list is capped because rendering every row made this page 757 KB, which is a
          poor trade on a phone.
        </p>
      )}
    </main>
  );
}
