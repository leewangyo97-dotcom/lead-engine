"use client";

import { useState } from "react";

const OUTCOMES = [
  { value: "replied", label: "Replied", tone: "border-go text-go" },
  { value: "won", label: "Won", tone: "border-go text-go" },
  { value: "lost", label: "Lost", tone: "border-stop text-stop" },
] as const;

/**
 * One business that was messaged: where to look for an answer, and the buttons
 * that record it. The answer is marked on the row at once, with an undo, and
 * nothing reloads: a sweep through forty rows should not be forty page loads.
 */
export function ReplyRow({
  id,
  name,
  meta,
  status: initial,
  gmail,
  whatsapp,
}: {
  id: string;
  name: string;
  meta: string;
  status: string;
  gmail: string | null;
  whatsapp: string | null;
}) {
  const [status, setStatus] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const answered = status === "replied" || status === "won" || status === "lost";

  async function record(outcome: string) {
    setBusy(outcome);
    setError(null);
    try {
      const res = await fetch(`/api/prospects/${id}/outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      if (res.ok) setStatus(outcome === "reopen" ? "contacted" : outcome);
      else setError("not saved");
    } catch {
      setError("could not reach the server");
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="flex flex-wrap items-start justify-between gap-4 border-t border-rule-soft px-5 py-4 first:border-t-0">
      <div className="min-w-0">
        <a href={`/prospects?prospect=${id}`} className="text-primary hover:underline">
          {name}
        </a>
        <p className="mt-1 text-caption text-muted">{meta}</p>
        <p className="mt-2 flex flex-wrap gap-4 text-caption">
          {gmail && (
            <a href={gmail} target="_blank" rel="noreferrer noopener" className="text-accent underline underline-offset-2">
              Check Gmail
            </a>
          )}
          {whatsapp && (
            <a href={whatsapp} target="_blank" rel="noreferrer noopener" className="text-accent underline underline-offset-2">
              Open the WhatsApp chat
            </a>
          )}
        </p>
      </div>

      {answered ? (
        <span className="flex items-center gap-3 text-body-sm">
          <span className={status === "lost" ? "text-muted" : "text-go"}>
            ✓ {OUTCOMES.find((o) => o.value === status)?.label}
          </span>
          <button
            type="button"
            onClick={() => record("reopen")}
            disabled={busy !== null}
            className="text-caption text-faint underline underline-offset-2 hover:text-secondary disabled:opacity-50"
          >
            undo
          </button>
        </span>
      ) : (
        <span className="flex flex-wrap items-center gap-2">
          {OUTCOMES.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => record(o.value)}
              disabled={busy !== null}
              className={`rounded-sm border px-3 py-1 text-body-sm hover:bg-hovered disabled:opacity-50 ${o.tone}`}
            >
              {busy === o.value ? "…" : o.label}
            </button>
          ))}
        </span>
      )}
      {error && (
        <span role="alert" className="w-full text-caption text-stop">
          {error}
        </span>
      )}
    </li>
  );
}
