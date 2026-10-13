"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Run {
  status: string;
  conclusion: string | null;
  url: string;
  createdAt: string;
}

const POLL_MS = 15_000;
const CLOCK_SLACK_MS = 60_000;

/**
 * "Run now" for queued searches: starts the drain on GitHub Actions, then
 * watches the run and refreshes the page when it finishes, so the new rows
 * appear without anyone opening a terminal.
 *
 * Without a GitHub token the server says so, and the note shows that answer
 * next to the command it would have replaced.
 */
export function RunSearchesButton() {
  const router = useRouter();
  const [since, setSince] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [runUrl, setRunUrl] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/searches/run", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote(`${body.error ?? "could not start it"} — pnpm search:run --drain`);
        return;
      }
      setSince(Date.now());
      setNote("Started on GitHub. A country takes a few minutes; this page refreshes when it is done.");
    } catch {
      setNote("could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (since === null) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/searches/run", { cache: "no-store" });
        if (!res.ok) return;
        const { run } = (await res.json()) as { run: Run | null };
        if (!run || Date.parse(run.createdAt) < since - CLOCK_SLACK_MS) return;
        setRunUrl(run.url);
        if (run.status !== "completed") return;
        setSince(null);
        setNote(
          run.conclusion === "success"
            ? "Done — the new rows are in."
            : `The run ended ${run.conclusion ?? "badly"}.`,
        );
        router.refresh();
      } catch {
        // A missed poll is retried on the next tick.
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [since, router]);

  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={busy || since !== null}
        className="rounded-xs bg-accent px-3 py-1 text-body-sm text-on-accent disabled:opacity-50"
      >
        {since !== null ? "Running…" : busy ? "Starting…" : "Run now"}
      </button>
      {note && <span className="text-caption text-muted">{note}</span>}
      {runUrl && (
        <a
          href={runUrl}
          target="_blank"
          rel="noreferrer"
          className="text-caption text-accent underline underline-offset-2"
        >
          Watch the run
        </a>
      )}
    </span>
  );
}
