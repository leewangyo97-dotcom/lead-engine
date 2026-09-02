"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Loaded {
  current: string;
  draft: { id: string; body: string; angle: string | null } | null;
  prompt: string;
}

/**
 * The enhance control: shows the message that would be sent, and the enhanced
 * one beside it when there is one.
 *
 * There is no "generate" here because nothing generates on the server. The
 * button opens the prompt, that goes into Claude Code, and `pnpm apply:enhance`
 * stores the result — which then appears in this same panel as a draft to accept
 * or discard. Showing both messages side by side is the point: a rewrite nobody
 * compared is a rewrite nobody checked.
 */
export function ProspectEnhance({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/prospects/${id}/enhance`);
      const body = await res.json();
      if (!res.ok) setNote(body.error ?? "could not load");
      else {
        setData(body);
        setOpen(true);
      }
    } catch {
      setNote("could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  async function discard() {
    setBusy(true);
    try {
      await fetch(`/api/prospects/${id}/enhance`, { method: "DELETE" });
      setData(data ? { ...data, draft: null } : null);
      setNote("draft discarded");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function copyPrompt() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.prompt);
      setNote("prompt copied — paste it into Claude Code");
    } catch {
      // Clipboard access is refused in some contexts; the textarea below is
      // still selectable, so this is a note rather than a failure.
      setNote("could not copy — select the prompt below instead");
    }
  }

  if (!open) {
    return (
      <div className="flex flex-col items-start gap-1">
        <button
          type="button"
          onClick={load}
          disabled={busy}
          title="Rewrite this message using what we actually know about them"
          className="rounded-xs border border-rule px-3 py-1 text-body-sm text-secondary hover:bg-hovered disabled:opacity-50"
        >
          {busy ? "Loading…" : "✦ Enhance"}
        </button>
        {note && <span className="text-caption text-muted">{note}</span>}
      </div>
    );
  }

  // An overlay rather than a panel inside the cell. Two messages side by side
  // need the width of the page; in a table column they were clipped, and a diff
  // nobody can read side by side is not a diff.
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Message for ${name}`}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-canvas/80 p-6 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="mt-10 w-full max-w-3xl rounded-md border border-rule bg-surface p-6 shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <span className="text-label uppercase text-muted">Message for {name}</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-body-sm text-secondary hover:text-primary"
        >
          Close
        </button>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-label uppercase text-muted">Current</p>
          <p className="mt-1 whitespace-pre-wrap text-body-sm text-secondary">{data?.current}</p>
        </div>
        <div>
          <p className="text-label uppercase text-muted">
            Enhanced {data?.draft?.angle ? `· ${data.draft.angle}` : ""}
          </p>
          {data?.draft ? (
            <p className="mt-1 whitespace-pre-wrap text-body-sm text-primary">{data.draft.body}</p>
          ) : (
            <p className="mt-1 text-body-sm text-faint">
              None yet. Copy the prompt, run it in Claude Code, then{" "}
              <code className="font-mono text-data-sm">pnpm apply:enhance</code>.
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copyPrompt}
          className="rounded-xs border border-rule px-3 py-1 text-body-sm text-secondary hover:bg-hovered"
        >
          Copy prompt
        </button>
        {data?.draft && (
          <button
            type="button"
            onClick={discard}
            disabled={busy}
            className="rounded-xs border border-rule px-3 py-1 text-body-sm text-secondary hover:bg-hovered disabled:opacity-50"
          >
            Discard draft
          </button>
        )}
        {data?.draft && (
          // Accepting is implicit and said out loud, because a button that only
          // sets a flag invites the question of whether it did anything.
          <span className="text-caption text-muted">
            This draft is what the WhatsApp and Email buttons will send.
          </span>
        )}
      </div>

      {note && <p className="mt-2 text-caption text-muted">{note}</p>}

      <details className="mt-3">
        <summary className="cursor-pointer text-caption text-faint">Show prompt</summary>
        <textarea
          readOnly
          value={data?.prompt ?? ""}
          rows={10}
          className="mt-2 w-full rounded-xs border border-rule bg-canvas p-2 font-mono text-data-sm text-secondary"
        />
      </details>
      </div>
    </div>
  );
}
