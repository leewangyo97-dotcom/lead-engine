"use client";

import { useState, useTransition } from "react";
import { logOutcome, type Outcome } from "../actions";
import { recordedOutcome } from "@/lib/leads/outcome-status";

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
export function OutcomeButtons({ leadId, status }: { leadId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  // The click's own confirmation. The status line below says what is on
  // record; this says the press just now was saved, so a press is never met
  // with nothing — see `recordedOutcome` for the morning that went wrong.
  const [saved, setSaved] = useState<string | null>(null);
  const recorded = recordedOutcome(status);

  return (
    <div>
    <div className="flex flex-wrap gap-3">
      {OUTCOMES.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={pending}
          aria-pressed={recorded?.pressed === o.value}
          onClick={() =>
            startTransition(async () => {
              await logOutcome(leadId, o.value);
              setSaved(o.label);
            })
          }
          className={`rounded-sm border px-4 py-2 text-body-sm transition-colors hover:bg-hovered disabled:opacity-50 ${o.tone}`}
        >
          {recorded?.pressed === o.value ? `✓ ${o.label}` : o.label}
        </button>
      ))}
    </div>
    {/* role="status": read out when it changes, without moving focus. */}
    <p role="status" className="mt-3 min-h-[20px] text-body-sm text-secondary">
      {pending
        ? "Saving…"
        : saved
          ? `Saved: ${saved}.`
          : recorded
            ? `Recorded: ${recorded.text}.`
            : ""}
    </p>
    </div>
  );
}
