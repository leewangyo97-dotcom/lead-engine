"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  id: string;
  email: string | null;
  phoneE164: string | null;
  overridden: string[];
}

/**
 * Per-row refresh and hand editing.
 *
 * Editing is here rather than on a detail page because the correction people
 * actually make is one wrong phone number, spotted while scanning the table. A
 * page transition to fix one field is enough friction that the field stays
 * wrong.
 */
export function ProspectRowActions({ id, email, phoneE164, overridden }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<"refresh" | "save" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [draft, setDraft] = useState({ email: email ?? "", phoneE164: phoneE164 ?? "" });

  async function refresh() {
    setBusy("refresh");
    setNote(null);
    try {
      const res = await fetch(`/api/prospects/${id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) setNote(data.error ?? "refresh failed");
      else if (data.outcome === "missing") setNote("no longer on the map");
      else if (data.changed?.length) setNote(`updated ${data.changed.join(", ")}`);
      else setNote("no change");
      router.refresh();
    } catch {
      setNote("could not reach the server");
    } finally {
      setBusy(null);
    }
  }

  // Only fields the person actually touched. Sending the whole form would pin
  // every pre-filled value as a hand edit, so opening the editor and saving one
  // email would silently freeze the phone number against all future refreshes.
  const edits = {
    ...(draft.email !== (email ?? "") ? { email: draft.email } : {}),
    ...(draft.phoneE164 !== (phoneE164 ?? "") ? { phoneE164: draft.phoneE164 } : {}),
  };

  async function save() {
    if (Object.keys(edits).length === 0) {
      setEditing(false);
      return;
    }
    setBusy("save");
    setNote(null);
    try {
      const res = await fetch(`/api/prospects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edits),
      });
      const data = await res.json();
      if (!res.ok) setNote(data.error ?? "could not save");
      else {
        setEditing(false);
        // Saying this out loud is the point of the feature: the edit is not
        // just applied, it is protected from the next refresh.
        setNote("saved — kept through refreshes");
        router.refresh();
      }
    } catch {
      setNote("could not reach the server");
    } finally {
      setBusy(null);
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <input
          aria-label="Email"
          value={draft.email}
          placeholder="email"
          onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          className="w-44 rounded-xs border border-rule bg-sunk px-2 py-1 text-body-sm text-primary"
        />
        <input
          aria-label="Phone"
          value={draft.phoneE164}
          placeholder="+63…"
          onChange={(e) => setDraft({ ...draft, phoneE164: e.target.value })}
          className="w-44 rounded-xs border border-rule bg-sunk px-2 py-1 font-mono text-data-sm text-primary"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={busy !== null}
            className="rounded-xs bg-accent px-3 py-1 text-body-sm text-on-accent disabled:opacity-50"
          >
            {busy === "save" ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setDraft({ email: email ?? "", phoneE164: phoneE164 ?? "" });
            }}
            className="rounded-xs border border-rule px-3 py-1 text-body-sm text-secondary"
          >
            Cancel
          </button>
        </div>
        <p className="text-caption text-faint">Clearing a field keeps it clear after a refresh.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={refresh}
          disabled={busy !== null}
          title="Re-read this business from OpenStreetMap and its website"
          className="rounded-xs border border-rule px-3 py-1 text-body-sm text-secondary hover:bg-hovered disabled:opacity-50"
        >
          {busy === "refresh" ? "Refreshing…" : "Refresh"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-xs border border-rule px-3 py-1 text-body-sm text-secondary hover:bg-hovered"
        >
          Edit
        </button>
      </div>
      {overridden.length > 0 && (
        <span
          title={`Edited by hand: ${overridden.join(", ")}. Refreshes will not overwrite these.`}
          className="text-caption text-muted"
        >
          edited: {overridden.join(", ")}
        </span>
      )}
      {note && <span className="text-caption text-muted">{note}</span>}
    </div>
  );
}

/**
 * Bulk refresh for a whole search.
 *
 * Map data only, and the label says so — someone who clicks this and then finds
 * no new emails should know why before they click, not after.
 */
export function RefreshAllButton({ searchId, count }: { searchId: string; count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/searches/${searchId}/refresh`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) setNote(data.error ?? "refresh failed");
      else
        setNote(
          `${data.updated} updated, ${data.unchanged} unchanged` +
            (data.missing ? `, ${data.missing} no longer on the map` : ""),
        );
      router.refresh();
    } catch {
      setNote("could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={busy || count === 0}
        title="Re-read all of these from OpenStreetMap. Websites are not revisited — that is `pnpm enrich`."
        className="rounded-xs border border-rule px-3 py-1 text-body-sm text-secondary hover:bg-hovered disabled:opacity-50"
      >
        {busy ? "Refreshing…" : "Refresh map data"}
      </button>
      {note && <span className="text-body-sm text-muted">{note}</span>}
    </span>
  );
}
