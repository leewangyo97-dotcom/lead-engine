import { getDueFollowups } from "@/lib/leads/followup-queries";
import { LADDER_DAYS } from "@/lib/followups";

import { Shell } from "@/app/components/shell";

export const dynamic = "force-dynamic";

export default async function Followups() {
  const due = await getDueFollowups();

  return (
    <Shell current="/followups">
      <div className="mx-auto max-w-content">

      <h1
        className="mt-4 font-display text-heading-lg text-primary"
        style={{ fontVariationSettings: "'opsz' 24, 'SOFT' 25, 'WONK' 0" }}
      >
        Follow-ups due
      </h1>
      <p className="mt-2 max-w-prose text-body text-secondary">
        Day {LADDER_DAYS[0]} and day {LADDER_DAYS[1]} after the last touch, for anything unanswered.
        A logged reply removes a lead from this list by itself.
      </p>

      {due.length === 0 ? (
        <p className="mt-7 rounded-md border border-rule bg-surface p-7 text-body text-muted">
          Nothing due. This fills once sends are logged on a lead detail page.
        </p>
      ) : (
        <ul className="mt-7 flex flex-col gap-2">
          {due.map((row) => (
            <li key={row.leadId} className="rounded-md border border-rule bg-surface p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <a
                  className="text-subhead text-primary underline-offset-2 hover:underline"
                  href={`/lead/${row.leadId}`}
                >
                  {row.company}
                </a>
                <span className="font-mono text-data-sm tabular-nums text-muted">
                  step {row.nextStep} &middot; {row.daysSince}d since last touch
                </span>
              </div>
              <p className="mt-2 text-body-sm text-secondary">{row.title}</p>
              <p className="mt-2 text-caption text-faint">
                previous: &ldquo;{row.previousSubject}&rdquo;
                {row.previousAngle ? ` (angle: ${row.previousAngle})` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-7 max-w-prose text-caption text-faint">
        Nothing is drafted here. Run <code className="font-mono text-data">/daily-run</code> and the
        copywriter writes these in the same batched call as the day&rsquo;s first touches &mdash;
        one model call, not one per follow-up.
      </p>
      </div>
    </Shell>
  );
}
