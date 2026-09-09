"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { PLACE_CATEGORIES } from "@/lib/places/osm-categories";

/** Turns `lawFirms` into `Law firms` without a second label table to drift. */
function label(category: string): string {
  const spaced = category.replace(/([A-Z])/g, " $1").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const DRAIN = "pnpm search:run --drain";

/**
 * What to do about a search that cannot run in a request.
 *
 * A country resolves to an OpenStreetMap area rather than a radius, and querying
 * one takes minutes — longer than a serverless function may run. So it is
 * queued, and the only thing that empties the queue is the worker on the command
 * line. Saying that plainly, with the command to hand, is the difference between
 * a queue and a dead end.
 */
function QueuedPanel({
  searchId,
  resolvedName,
  copied,
  onCopied,
}: {
  searchId: string;
  resolvedName?: string;
  copied: boolean;
  onCopied: (v: boolean) => void;
}) {
  return (
    <div className="mt-4 rounded-sm border border-hold bg-hold-tint p-4 text-body-sm">
      <p className="text-primary">
        Queued{resolvedName ? `: ${resolvedName.split(",")[0]}` : ""} — this is a whole area, not a
        radius. A country-wide OpenStreetMap query takes minutes, which is longer than a web request
        may stay open, so nothing is running yet.
      </p>
      <p className="mt-3 text-secondary">Start the worker in a terminal:</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <code className="rounded-xs border border-rule bg-surface px-3 py-1 font-mono text-data">
          {DRAIN}
        </code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(DRAIN);
              onCopied(true);
            } catch {
              // Clipboard access is refused in some contexts. The command is on
              // screen either way, so this only stops claiming it was copied.
              onCopied(false);
            }
          }}
          className="text-caption text-secondary underline underline-offset-2 hover:text-primary"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <p className="mt-3 text-caption text-muted">
        It drains every queued search, this one included. When it finishes, the search appears under
        Recent searches above — its chip reads <span className="font-mono text-data">queued</span>
        {" "}until then. Search id{" "}
        <span className="font-mono text-data-sm text-secondary">{searchId}</span>.
      </p>
    </div>
  );
}

export function ProspectSearchForm({
  defaultQuery = "",
  defaultCategories,
}: {
  defaultQuery?: string;
  defaultCategories?: string[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultQuery);
  // Showing the categories of the search on screen, so the form describes what
  // is in the table rather than contradicting it.
  const [selected, setSelected] = useState<string[]>(
    defaultCategories?.length ? defaultCategories : ["clinics"],
  );
  const [radiusKm, setRadiusKm] = useState(15);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState<{ searchId: string; resolvedName?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // A country resolves to an admin area, where a radius is meaningless. The
  // input only knows after geocoding, so this is a hint rather than a guarantee.
  const looksLikeArea = query.trim().length > 0 && !query.includes(",");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setQueued(null);
    setCopied(false);

    try {
      const res = await fetch("/api/searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, categories: selected, radiusM: radiusKm * 1000 }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "search failed");
        return;
      }
      if (data.queued) {
        // Not the API's sentence. It said "Whole-country searches run in the
        // background. Run `pnpm search:run --drain`." — accurate, and read as
        // nothing happened: no worker runs by itself, so a person who does not
        // go to a terminal is waiting for something that will never start.
        setQueued({ searchId: data.searchId, resolvedName: data.resolvedName });
        return;
      }
      router.push(`/prospects?search=${data.searchId}` as Route);
      router.refresh();
    } catch {
      setError("could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-md border border-rule bg-surface p-5">
      <label className="block text-label uppercase text-muted" htmlFor="place">
        Location
      </label>
      <input
        id="place"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cebu City, Philippines"
        className="mt-2 w-full rounded-sm border border-rule bg-sunk px-4 py-3 text-body text-primary placeholder:text-faint"
      />

      <p className="mt-5 text-label uppercase text-muted">Categories</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {PLACE_CATEGORIES.map((c) => {
          const on = selected.includes(c);
          return (
            <button
              key={c}
              type="button"
              aria-pressed={on}
              onClick={() =>
                setSelected((s) => (on ? s.filter((x) => x !== c) : [...s, c]))
              }
              className={`rounded-xs border px-3 py-1 text-body-sm transition-colors ${
                on
                  ? "border-accent bg-accent-tint text-primary"
                  : "border-rule text-secondary hover:bg-hovered"
              }`}
            >
              {label(c)}
            </button>
          );
        })}
      </div>

      {!looksLikeArea && (
        <div className="mt-5">
          <label className="block text-label uppercase text-muted" htmlFor="radius">
            Radius — {radiusKm} km
          </label>
          <input
            id="radius"
            type="range"
            min={1}
            max={50}
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            className="mt-2 w-full max-w-xs accent-[var(--accent-base)]"
          />
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy || !query.trim() || selected.length === 0}
          className="rounded-sm bg-accent px-5 py-3 text-body-sm text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Searching…" : "Search"}
        </button>
        {busy && (
          <span className="text-body-sm text-muted">
            Geocoding, then asking OpenStreetMap — a few seconds.
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-sm border border-stop bg-stop-tint p-3 text-body-sm">
          {error}
        </p>
      )}
      {queued && <QueuedPanel {...queued} copied={copied} onCopied={setCopied} />}
    </form>
  );
}
