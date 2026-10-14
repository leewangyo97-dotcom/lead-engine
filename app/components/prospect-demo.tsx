"use client";

import { useEffect, useState } from "react";

interface Run {
  status: string;
  conclusion: string | null;
  url: string;
  createdAt: string;
}

const POLL_MS = 10_000;
const GIVE_UP_MS = 8 * 60_000;
const CLOCK_SLACK_MS = 60_000;

/**
 * The demo page for a business with no website (lib/demo): preview it, publish
 * it, then link it. Once published, Copy email links it instead of offering a
 * sample: "show, don't tell", asked for on 14 Oct.
 *
 * Publishing runs on GitHub Actions (`demo.yml`), like Enhance. Without the
 * GitHub token it says so and hands over the command that does the same job.
 */
export function ProspectDemo({
  id,
  demoUrl,
  eligible,
}: {
  id: string;
  demoUrl: string | null;
  eligible: boolean;
}) {
  const [url, setUrl] = useState(demoUrl);
  const [since, setSince] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [command, setCommand] = useState<string | null>(null);
  const [runUrl, setRunUrl] = useState<string | null>(null);

  async function publish() {
    setBusy(true);
    setNote(null);
    setCommand(null);
    try {
      const res = await fetch(`/api/prospects/${id}/demo`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setSince(Date.now());
        setNote("Publishing — about 1–2 minutes.");
      } else {
        setNote(body.error ?? "could not start it");
        if (body.command) setCommand(body.command);
      }
    } catch {
      setNote("could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  // Polls until the page is recorded as live, the run fails, or it has taken
  // too long.
  useEffect(() => {
    if (since === null) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/prospects/${id}/demo`, { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { url: string | null; run: Run | null };
        if (body.run && Date.parse(body.run.createdAt) >= since - CLOCK_SLACK_MS) setRunUrl(body.run.url);
        if (body.url) {
          setUrl(body.url);
          setSince(null);
          setNote("Live. Copy email now links it.");
        } else if (body.run?.status === "completed" && body.run.conclusion !== "success") {
          setSince(null);
          setNote(`The run ended ${body.run.conclusion ?? "badly"}.`);
        } else if (Date.now() - since > GIVE_UP_MS) {
          setSince(null);
          setNote("Still not live after 8 minutes. Check the run on GitHub.");
        }
      } catch {
        // A missed poll is retried on the next tick.
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [since, id]);

  if (!eligible && !url) return null;

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap items-center gap-2">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="rounded-xs border border-rule px-3 py-1 text-body-sm text-accent hover:bg-hovered"
          >
            Demo page ↗
          </a>
        ) : (
          <button
            type="button"
            onClick={publish}
            disabled={busy || since !== null}
            title="Publish a one-page demo website for them, from their map listing"
            className="rounded-xs border border-rule px-3 py-1 text-body-sm text-secondary hover:bg-hovered disabled:opacity-50"
          >
            {since !== null ? "Publishing…" : busy ? "Starting…" : "Make demo"}
          </button>
        )}
        <a
          href={`/api/prospects/${id}/demo?preview=1`}
          target="_blank"
          rel="noreferrer"
          className="text-caption text-secondary underline underline-offset-2 hover:text-primary"
        >
          preview
        </a>
        {runUrl && since !== null && (
          <a href={runUrl} target="_blank" rel="noreferrer" className="text-caption text-accent underline underline-offset-2">
            watch the run
          </a>
        )}
      </div>
      {note && <span className="text-caption text-muted">{note}</span>}
      {command && (
        <span className="flex flex-wrap items-center gap-2 text-caption text-muted">
          Or in a terminal:
          <code className="select-all rounded-xs border border-rule bg-sunk px-2 font-mono text-data-sm text-secondary">
            {command}
          </code>
        </span>
      )}
    </div>
  );
}
