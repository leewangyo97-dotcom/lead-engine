"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Run {
  status: string;
  conclusion: string | null;
  url: string;
  createdAt: string;
}

interface Loaded {
  current: string;
  draft: { id: string; body: string; angle: string | null } | null;
  prompt: string;
  /** Whether the server can start a run: GITHUB_DISPATCH_TOKEN is set. */
  oneClick: boolean;
  /** The latest one-click run for this prospect, if any. */
  run: Run | null;
}

/** How often the panel asks whether Claude has finished, and when it stops asking. */
const POLL_MS = 10_000;
const GIVE_UP_MS = 8 * 60_000;
/** GitHub's clock and this one differ; a run this much older still counts as ours. */
const CLOCK_SLACK_MS = 60_000;

const isRunning = (run: Run | null) => run !== null && run.status !== "completed";

/**
 * The enhance control: shows the message that would be sent, and the enhanced
 * one beside it when there is one.
 *
 * Nothing generates on the server. Since 13 Oct, opening it with no draft starts
 * `enhance.yml`: GitHub Actions runs the prompt through Claude Code on Joshua's
 * subscription, and `apply:enhance` stores what passes its checks. The panel
 * waits for the draft, which then sits beside the current message to accept or
 * discard. Showing both side by side is the point: a rewrite nobody compared is
 * a rewrite nobody checked. Without a GitHub token it falls back to the loop it
 * replaced (copy the prompt, run it in Claude Code, `pnpm apply:enhance`) and
 * says so.
 */
export function ProspectEnhance({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  /** When the run being waited for started; null when nothing is being waited for. */
  const [waitingSince, setWaitingSince] = useState<number | null>(null);
  const [failed, setFailed] = useState<Run | null>(null);
  /** The draft that existed before the run, so a new one can be told from it. */
  const draftBefore = useRef<string | null>(null);

  async function fetchState(): Promise<Loaded | null> {
    const res = await fetch(`/api/prospects/${id}/enhance`, { cache: "no-store" });
    const body = await res.json();
    if (!res.ok) {
      setNote(body.error ?? "could not load");
      return null;
    }
    return body as Loaded;
  }

  async function start(currentDraftId: string | null) {
    setBusy(true);
    setNote(null);
    setFailed(null);
    try {
      const res = await fetch(`/api/prospects/${id}/enhance`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setNote(body.error ?? "could not start Claude");
        return;
      }
      draftBefore.current = currentDraftId;
      setWaitingSince(Date.now());
    } catch {
      setNote("could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  async function load() {
    setBusy(true);
    setNote(null);
    try {
      const loaded = await fetchState();
      if (!loaded) return;
      setData(loaded);
      setOpen(true);
      if (!loaded.oneClick) return;
      if (isRunning(loaded.run)) {
        // Already going, from an earlier click: watch it rather than start another.
        draftBefore.current = loaded.draft?.id ?? null;
        setWaitingSince(Date.parse(loaded.run!.createdAt));
      } else if (!loaded.draft && waitingSince === null) {
        // One click: nothing written yet, so opening the panel is the request.
        await start(null);
      }
    } catch {
      setNote("could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  // Polls until the draft lands, the run fails, or it has taken too long. It
  // keeps going with the panel closed, so the button below can say it is done.
  useEffect(() => {
    if (waitingSince === null) return;
    const timer = setInterval(async () => {
      let loaded: Loaded | null = null;
      try {
        const res = await fetch(`/api/prospects/${id}/enhance`, { cache: "no-store" });
        if (res.ok) loaded = (await res.json()) as Loaded;
      } catch {
        return;
      }
      if (!loaded) return;
      setData(loaded);
      const ours =
        loaded.run && Date.parse(loaded.run.createdAt) >= waitingSince - CLOCK_SLACK_MS
          ? loaded.run
          : null;
      if (loaded.draft && loaded.draft.id !== draftBefore.current) {
        setWaitingSince(null);
        setNote("Claude's draft is in. Read it before you send it.");
      } else if (ours?.status === "completed") {
        setWaitingSince(null);
        setFailed(ours);
      } else if (Date.now() - waitingSince > GIVE_UP_MS) {
        setWaitingSince(null);
        setNote("Still not back after 8 minutes. Check the run on GitHub.");
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [waitingSince, id]);

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

  const writing = waitingSince !== null;

  if (!open) {
    return (
      <div className="flex flex-col items-start gap-1">
        <button
          type="button"
          onClick={load}
          disabled={busy}
          title="Claude rewrites this message around their problem and how you could help"
          className="rounded-xs border border-rule px-3 py-1 text-body-sm text-secondary hover:bg-hovered disabled:opacity-50"
        >
          {busy ? "Loading…" : writing ? "✦ Writing…" : "✦ Enhance"}
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
        <span className="text-label text-secondary">Message for {name}</span>
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
          <p className="text-label text-secondary">Current</p>
          <p className="mt-1 whitespace-pre-wrap text-body-sm text-secondary">{data?.current}</p>
        </div>
        <div>
          <p className="text-label text-secondary">
            Enhanced {data?.draft?.angle && !writing ? `· ${data.draft.angle}` : ""}
          </p>
          {writing ? (
            <p role="status" className="mt-1 text-body-sm text-secondary">
              Claude is writing it. That usually takes 1–3 minutes, and you can close this
              meanwhile.{" "}
              {data?.run?.url && (
                <a
                  href={data.run.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent underline underline-offset-2"
                >
                  Watch the run
                </a>
              )}
            </p>
          ) : failed ? (
            <p role="alert" className="mt-1 text-body-sm text-stop">
              Claude&apos;s run ended {failed.conclusion ?? "without a draft"}.{" "}
              <a
                href={failed.url}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                See why on GitHub
              </a>
            </p>
          ) : data?.draft ? (
            <p className="mt-1 whitespace-pre-wrap text-body-sm text-primary">{data.draft.body}</p>
          ) : data?.oneClick ? (
            <p className="mt-1 text-body-sm text-faint">None yet.</p>
          ) : (
            <p className="mt-1 text-body-sm text-faint">
              None yet. Copy the prompt, run it in Claude Code, then{" "}
              <code className="font-mono text-data-sm">pnpm apply:enhance</code>. One click needs{" "}
              <code className="font-mono text-data-sm">GITHUB_DISPATCH_TOKEN</code> — see the
              RUNBOOK.
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {data?.oneClick && (
          <button
            type="button"
            onClick={() => start(data.draft?.id ?? null)}
            disabled={busy || writing}
            className="rounded-xs bg-accent px-3 py-1 text-body-sm text-on-accent disabled:opacity-50"
          >
            {writing ? "Writing…" : data.draft ? "✦ Write a new one" : "✦ Write it with Claude"}
          </button>
        )}
        <button
          type="button"
          onClick={copyPrompt}
          className="rounded-xs border border-rule px-3 py-1 text-body-sm text-secondary hover:bg-hovered"
        >
          Copy prompt
        </button>
        {data?.draft && !writing && (
          <button
            type="button"
            onClick={discard}
            disabled={busy}
            className="rounded-xs border border-rule px-3 py-1 text-body-sm text-secondary hover:bg-hovered disabled:opacity-50"
          >
            Discard draft
          </button>
        )}
        {data?.draft && !writing && (
          // Accepting is implicit and said out loud, because a button that only
          // sets a flag invites the question of whether it did anything.
          <span className="text-caption text-muted">
            This draft is what the WhatsApp, Email and Copy email buttons will send.
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
