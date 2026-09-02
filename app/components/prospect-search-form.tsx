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
  const [note, setNote] = useState<string | null>(null);

  // A country resolves to an admin area, where a radius is meaningless. The
  // input only knows after geocoding, so this is a hint rather than a guarantee.
  const looksLikeArea = query.trim().length > 0 && !query.includes(",");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNote(null);

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
        setNote(data.note);
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
      {note && (
        <p className="mt-4 rounded-sm border border-hold bg-hold-tint p-3 text-body-sm">{note}</p>
      )}
    </form>
  );
}
