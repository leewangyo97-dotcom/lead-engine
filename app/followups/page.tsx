import { getDueFollowups } from "@/lib/leads/followup-queries";
import { LADDER_DAYS, ladderRungs } from "@/lib/followups";

import { Shell } from "@/app/components/shell";

export const dynamic = "force-dynamic";

/**
 * The ladder as a track, from Figma 3:1437: Sent — Day 4 — Day 11, joined, with
 * the rungs behind you filled and the one owed now ringed.
 *
 * A row used to read "step 2", which requires the reader to hold the ladder in
 * their head to know what is owed and how much is left. The track says both.
 */
function LadderTrack({ nextStep }: { nextStep: number }) {
  const rungs = ladderRungs(nextStep);
  return (
    <ol className="flex items-center gap-2" aria-label="Follow-up sequence">
      {rungs.map((rung, i) => (
        <li key={rung.label} className="flex items-center gap-2">
          {/* An explicit 1px: this project replaces Tailwind's spacing scale,
              and `h-px` is not one of its keys — it produces no CSS at all and
              the connector would be invisible. */}
          {i > 0 && <span aria-hidden className="h-[1px] w-6 bg-rule sm:w-10" />}
          <span className="flex items-center gap-2">
            {/* 12px, the size of Figma's rung ellipse (3:1439). */}
            <span
              aria-hidden
              className={`h-4 w-4 shrink-0 rounded-full ${
                rung.state === "done"
                  ? "bg-go"
                  : rung.state === "due"
                    ? "bg-hold ring-2 ring-hold-tint"
                    : "bg-rule-strong"
              }`}
            />
            <span
              className={`text-caption ${
                rung.state === "later" ? "text-faint" : "text-secondary"
              }`}
            >
              {rung.label}
              <span className="sr-only">
                {rung.state === "done"
                  ? " — sent"
                  : rung.state === "due"
                    ? " — due now"
                    : " — not yet"}
              </span>
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

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
      {/* Figma 3:1431 puts the count directly under the heading. */}
      <p className="mt-2 font-mono text-data-sm tabular-nums text-muted">
        {due.length} due today
      </p>
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
                  href={row.kind === "prospect" ? "/prospects" : `/lead/${row.leadId}`}
                >
                  {row.company}
                </a>
                <span className="font-mono text-data-sm tabular-nums text-muted">
                  {row.daysSince}d since last touch
                </span>
              </div>
              <p className="mt-2 text-body-sm text-secondary">{row.title}</p>
              <div className="mt-3">
                <LadderTrack nextStep={row.nextStep} />
              </div>
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
