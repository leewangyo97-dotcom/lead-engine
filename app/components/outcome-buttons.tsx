"use client";

import { useTransition } from "react";
import { logOutcome, type Outcome } from "../actions";

const OUTCOMES: { value: Outcome; label: string; tone: string }[] = [
  { value: "sent", label: "I sent it", tone: "border-accent text-accent" },
  { value: "reply", label: "Replied", tone: "border-go text-go" },
  { value: "call", label: "Call booked", tone: "border-go text-go" },
  { value: "won", label: "Won", tone: "border-go text-go" },
  { value: "lost", label: "Lost", tone: "border-stop text-stop" },
  { value: "no_reply", label: "No reply", tone: "border-rule text-muted" },
];

/**
 * Outcome capture. Six buttons, because a form nobody fills in produces no
 * learning loop — and the loop is the only part of this tool that compounds.
 */
export function OutcomeButtons({ leadId }: { leadId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-3">
      {OUTCOMES.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => logOutcome(leadId, o.value))}
          className={`rounded-sm border px-4 py-2 text-body-sm transition-colors hover:bg-hovered disabled:opacity-50 ${o.tone}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
