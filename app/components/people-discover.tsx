"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatWhen } from "@/lib/people/format";

export interface JobView {
  id: string;
  status: string;
  progress: number;
  total: number;
  message: string | null;
  created: string;
}

const POLL_MS = 5_000;
const working = (j: JobView) => j.status === "queued" || j.status === "running";

/**
 * Starts discovery and shows how far it has got. Each start queues a job and
 * hands it to GitHub Actions; the page polls the job while one is open and
 * refreshes its table when a job finishes, so new people appear on their own.
 * Without GITHUB_DISPATCH_TOKEN the job waits for the command shown.
 */
export function DiscoverPanel({ jobs: initial, oneClick }: { jobs: JobView[]; oneClick: boolean }) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [command, setCommand] = useState<string | null>(null);
  const [domain, setDomain] = useState("");
  const [limit, setLimit] = useState(10);
  const open = useRef(new Set(initial.filter(working).map((j) => j.id)));
  const active = jobs.some(working);

  async function poll() {
    try {
      const res = await fetch("/api/people/jobs", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { jobs: (JobView & { createdAt: string })[] };
      const next = body.jobs.map((j) => ({ ...j, created: formatWhen(j.createdAt) }));
      const finished = next.some((j) => open.current.has(j.id) && !working(j));
      open.current = new Set(next.filter(working).map((j) => j.id));
      setJobs(next);
      if (finished) router.refresh();
    } catch {
      // A missed poll is retried on the next tick.
    }
  }

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(poll, POLL_MS);
    return () => clearInterval(timer);
    // poll reads only refs and setters; re-arming on every render is not needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  async function start(body: Record<string, unknown>) {
    setBusy(true);
    setNote(null);
    setCommand(null);
    try {
      const res = await fetch("/api/people/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const answer = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote(answer.error ?? "could not start it");
        return;
      }
      setDomain("");
      if (answer.started) {
        setNote(`Started on GitHub for ${answer.companies} ${answer.companies === 1 ? "company" : "companies"}. This page fills in as it goes.`);
      } else {
        setNote(`Queued ${answer.companies} ${answer.companies === 1 ? "company" : "companies"}, but it could not start on GitHub (${answer.note ?? "no token"}). Run it in a terminal:`);
        setCommand(answer.command);
      }
      open.current.add(answer.jobId);
      await poll();
    } catch {
      setNote("could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Discover decision-makers" className="mt-6 rounded-md border border-rule bg-surface p-5">
      <p className="text-label text-secondary">Discover</p>
      <p className="mt-1 max-w-prose text-body-sm text-muted">
        Reads each company&apos;s own website for founders, owners and directors, then checks SEC Form D
        filings and GitHub. Public pages only, robots.txt respected, one request a second per site.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-body-sm text-secondary">
          Up to
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="rounded-xs border border-rule bg-sunk px-2 py-1 text-body-sm text-primary"
          >
            {[5, 10, 25, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          companies
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => start({ seed: "prospects", limit })}
          className="rounded-xs bg-accent px-3 py-1 text-body-sm text-on-accent disabled:opacity-50"
        >
          From local businesses
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => start({ seed: "leads", limit })}
          className="rounded-xs border border-rule px-3 py-1 text-body-sm text-secondary hover:bg-hovered disabled:opacity-50"
        >
          From job leads
        </button>
      </div>

      <form
        className="mt-4 flex flex-wrap items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (domain.trim()) start({ domain: domain.trim() });
        }}
      >
        <label htmlFor="discover-domain" className="text-body-sm text-secondary">
          Or one company
        </label>
        <input
          id="discover-domain"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="example.com"
          className="w-[16rem] rounded-sm border border-rule bg-sunk px-3 py-1 text-body-sm text-primary placeholder:text-faint"
        />
        <button
          type="submit"
          disabled={busy || !domain.trim()}
          className="rounded-xs border border-rule px-3 py-1 text-body-sm text-secondary hover:bg-hovered disabled:opacity-50"
        >
          Add and discover
        </button>
      </form>

      {note && (
        <p role="status" className="mt-3 text-body-sm text-secondary">
          {note}
        </p>
      )}
      {(command || (!oneClick && active)) && (
        <code className="mt-2 inline-block rounded-xs border border-rule bg-sunk px-3 py-1 font-mono text-data-sm text-primary">
          {command ?? "pnpm people:discover --queued"}
        </code>
      )}

      {jobs.length > 0 && (
        <ul className="mt-5 flex flex-col gap-3">
          {jobs.map((j) => {
            const pct = j.total ? Math.round((j.progress / j.total) * 100) : 0;
            return (
              <li key={j.id} className="text-caption text-muted">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <span>
                    <span
                      className={`font-mono ${
                        j.status === "done" ? "text-go" : j.status === "failed" ? "text-stop" : "text-primary"
                      }`}
                    >
                      {j.status}
                    </span>{" "}
                    · {j.message ?? (j.status === "queued" ? "waiting to start" : "starting")}
                  </span>
                  <span className="font-mono">{j.created}</span>
                </div>
                {working(j) && (
                  <div
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Discovery progress"
                    className="mt-1 h-[6px] overflow-hidden rounded-xs bg-sunk"
                  >
                    <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
