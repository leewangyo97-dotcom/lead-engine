/**
 * The empty inbox from Figma 3:1212: a centred mark, a display-size line, and
 * one sentence of specifics.
 *
 * The design's copy is "Seven leads, four drafted. Next run is tomorrow at 4am."
 * — it reports what happened and when the next thing happens, which is what
 * makes an empty screen reassuring rather than ambiguous. The numbers here are
 * real for the same reason.
 *
 * The two cases stay distinct. Nothing harvested yet is a reason to wait;
 * everything harvested and rejected is a reason to look at the rubric, and
 * saying "the run will fill this" would be wrong when the run already has.
 */
export function EmptyInbox({
  judged,
  harvested,
  drafted,
  nextRun,
}: {
  judged: number;
  harvested: number;
  drafted: number;
  nextRun: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-md border border-rule bg-surface px-6 py-16 text-center">
      <span
        aria-hidden
        className="flex h-[56px] w-[56px] items-center justify-center rounded-full bg-sunk text-muted"
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 12h-6l-2 3h-4l-2-3H2" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
          <path d="m9 11 2 2 4-4" />
        </svg>
      </span>

      <h2
        className="mt-5 font-display text-heading-lg text-primary"
        style={{ fontVariationSettings: "'opsz' 24, 'SOFT' 25, 'WONK' 0" }}
      >
        You&rsquo;re through today&rsquo;s list
      </h2>

      <p className="mt-2 max-w-prose text-body text-muted">
        {harvested} lead{harvested === 1 ? "" : "s"} harvested this week, {drafted} drafted. Next run
        is {nextRun}.
      </p>

      {judged > 0 && (
        <p className="mt-3 max-w-prose text-body-sm text-muted">
          {judged} were set aside by the filter.{" "}
          <a className="text-accent underline underline-offset-2" href="/rejected">
            See what was turned away
          </a>{" "}
          if that looks wrong.
        </p>
      )}
    </div>
  );
}
