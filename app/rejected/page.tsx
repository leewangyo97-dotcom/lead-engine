import { getRejected } from "@/lib/leads/rejected-query";
import { Pill } from "@/app/components/pills";

export const dynamic = "force-dynamic";

export default async function Rejected() {
  const rows = await getRejected();
  // Parked leads each carry their own score in the reason, so they are tallied
  // as one bucket rather than 121 buckets of one.
  const bucket = (r: (typeof rows)[number]) =>
    r.status === "parked" ? "scored under the gate" : (r.reason ?? "no reason recorded");

  const byReason = new Map<string, number>();
  for (const r of rows) byReason.set(bucket(r), (byReason.get(bucket(r)) ?? 0) + 1);
  const summary = [...byReason.entries()].sort((a, b) => b[1] - a[1]);

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
        {rows.length} lead(s) the filter rejected or parked. The inbox answers what to do today;
        this answers why there is nothing to do, which is the question worth asking when the funnel
        is dry.
      </p>

      <section className="mt-7">
        <h2 className="mb-4 text-label uppercase text-muted">By reason</h2>
        <ul className="flex flex-wrap gap-3">
          {summary.map(([reason, n]) => (
            <li key={reason} className="rounded-sm border border-rule bg-surface px-4 py-2 text-body-sm">
              <span className="text-secondary">{reason}</span>{" "}
              <span className="font-mono tabular-nums text-primary">{n}</span>
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
    </main>
  );
}
