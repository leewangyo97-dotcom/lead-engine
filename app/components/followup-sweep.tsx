"use client";

import { useState, type ComponentProps } from "react";
import { ProspectContact } from "./prospect-contact";

export interface SweepItem {
  id: string;
  kind: "prospect" | "lead";
  name: string;
  href: string;
  /** "Follow-up 1 of 2 · 12 days since the last message". */
  detail: string;
  /** The send buttons for a business; a job lead's follow-up is written by /daily-run. */
  contact: ComponentProps<typeof ProspectContact> | null;
}

/**
 * The due follow-ups one at a time: who, which rung, and the same send buttons
 * as /prospects, which compose the right rung's text themselves.
 *
 * The list is a snapshot taken when the sweep starts. A send refreshes the
 * page, and the business that was just followed up leaves the due list; were
 * the sweep to follow the live list, "Next" would skip the one after it.
 */
export function FollowupSweep({ items }: { items: SweepItem[] }) {
  const [queue, setQueue] = useState<SweepItem[] | null>(null);
  const [index, setIndex] = useState(0);

  if (items.length === 0 && !queue) return null;

  if (!queue) {
    return (
      <div className="mt-7 flex flex-wrap items-center gap-4 rounded-md border border-accent bg-accent-tint p-5">
        <button
          type="button"
          onClick={() => {
            setQueue(items);
            setIndex(0);
          }}
          className="rounded-xs bg-accent px-4 py-2 text-body-sm text-on-accent"
        >
          Start sweep
        </button>
        <span className="text-body-sm text-secondary">
          {items.length} follow-up{items.length === 1 ? "" : "s"}, one at a time: send, then Next.
        </span>
      </div>
    );
  }

  const done = index >= queue.length;
  const item = queue[Math.min(index, queue.length - 1)];

  return (
    <section aria-label="Follow-up sweep" className="mt-7 rounded-md border border-accent bg-surface p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="font-mono text-data-sm tabular-nums text-muted">
          {done ? `${queue.length} of ${queue.length}` : `${index + 1} of ${queue.length}`}
        </span>
        <button
          type="button"
          onClick={() => setQueue(null)}
          className="text-body-sm text-secondary hover:text-primary"
        >
          End sweep
        </button>
      </div>

      {done ? (
        <p className="mt-4 text-body text-primary">
          That was the last one.{" "}
          <a href="/followups" className="text-accent underline underline-offset-2">
            Reload the list
          </a>{" "}
          to see what is still due.
        </p>
      ) : (
        <div className="mt-4">
          <a href={item.href} target="_blank" rel="noreferrer" className="text-subhead text-primary hover:underline">
            {item.name}
          </a>
          <p className="mt-1 text-body-sm text-secondary">{item.detail}</p>
          <div className="mt-4">
            {item.contact ? (
              // Keyed, so each business gets its own buttons' state.
              <ProspectContact key={item.id} {...item.contact} />
            ) : (
              <p className="text-body-sm text-muted">
                A job lead: its follow-up is written by <code className="font-mono text-data">/daily-run</code>,
                then sent from Gmail.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="rounded-xs border border-rule px-3 py-1 text-body-sm text-secondary hover:bg-hovered disabled:opacity-50"
        >
          ← Back
        </button>
        {!done && (
          <button
            type="button"
            onClick={() => setIndex((i) => i + 1)}
            className="rounded-xs bg-accent px-4 py-1 text-body-sm text-on-accent"
          >
            Next →
          </button>
        )}
      </div>
    </section>
  );
}
