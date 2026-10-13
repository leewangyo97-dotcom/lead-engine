"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { contactStatus, dayLabel, type LastContact } from "@/lib/places/contact-status";

/** What the Copy email button put on the clipboard, and where it goes. */
interface Copied {
  subject: string;
  body: string;
  to: string | null;
  /** False when the browser refused the clipboard and the text is shown instead. */
  onClipboard: boolean;
  /** When this same message was already marked sent (ISO), or null. */
  alreadySent: string | null;
}

async function toClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** A new Gmail message with the address and subject filled in; the body is pasted. */
function gmailCompose({ to, subject }: Copied): string {
  const query = new URLSearchParams({ view: "cm", fs: "1", to: to ?? "", su: subject });
  return `https://mail.google.com/mail/?${query}`;
}

/**
 * A copy icon beside one value in the copied-email panel, which becomes a tick
 * for a moment once it worked. Copying it replaces the email on the clipboard;
 * "copy the email again" puts it back. Where the browser refuses the clipboard,
 * one click on the value beside it selects all of it for Ctrl+C.
 */
function CopyIcon({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        if (!(await toClipboard(text))) return;
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      aria-label={done ? `${label} copied` : `Copy ${label}`}
      title={done ? "Copied" : `Copy ${label}`}
      className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-xs text-muted hover:bg-hovered hover:text-primary"
    >
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {done ? (
          <path d="M20 6 9 17l-5-5" />
        ) : (
          <>
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </>
        )}
      </svg>
    </button>
  );
}

interface Props {
  id: string;
  email: string | null;
  lastContact: LastContact | null;
  phoneE164: string | null;
  overridden: string[];
}

/**
 * Per-row refresh, hand editing, and copying the first email.
 *
 * Editing is here rather than on a detail page because the correction people
 * actually make is one wrong phone number, spotted while scanning the table. A
 * page transition to fix one field is enough friction that the field stays
 * wrong.
 */
export function ProspectRowActions({ id, email, phoneE164, overridden, lastContact }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<"refresh" | "save" | "copy" | null>(null);
  const [copied, setCopied] = useState<Copied | null>(null);
  const [sent, setSent] = useState<"no" | "saving" | "yes">("no");
  // From the server, so it survives a reload: whether "I sent it" was clicked,
  // when, and when the next follow-up falls due.
  const status = contactStatus(lastContact);
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

  /*
   * Copies the email the Email button would send, for pasting into Gmail by hand
   * — the path that still works when the Gmail token has expired and the mail
   * link opens an empty message.
   *
   * Nothing is recorded and the row stays in the queue until "I sent it": a
   * copy that never got pasted is not a contact.
   */
  async function copyEmail() {
    setBusy("copy");
    setNote(null);
    try {
      const res = await fetch(`/api/prospects/${id}/message`);
      const data = await res.json();
      if (!res.ok) {
        setNote(data.error ?? "could not write the email");
        return;
      }
      setCopied({ ...data, onClipboard: await toClipboard(data.body) });
      setSent("no");
    } catch {
      setNote("could not reach the server");
    } finally {
      setBusy(null);
    }
  }

  async function markSent() {
    setSent("saving");
    try {
      const res = await fetch(`/api/prospects/${id}/message`, { method: "POST" });
      const data = await res.json();
      if (res.ok) setSent("yes");
      else {
        setSent("no");
        setNote(data.error ?? "could not mark it sent");
      }
    } catch {
      setSent("no");
      setNote("could not reach the server");
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
          className="w-[176px] rounded-xs border border-rule bg-sunk px-2 py-1 text-body-sm text-primary"
        />
        <input
          aria-label="Phone"
          value={draft.phoneE164}
          placeholder="+63…"
          onChange={(e) => setDraft({ ...draft, phoneE164: e.target.value })}
          className="w-[176px] rounded-xs border border-rule bg-sunk px-2 py-1 font-mono text-data-sm text-primary"
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
        <button
          type="button"
          onClick={copyEmail}
          disabled={busy !== null}
          title="Copy a short, plain-English email for this business, ready to paste into Gmail"
          className="rounded-xs border border-rule px-3 py-1 text-body-sm text-secondary hover:bg-hovered disabled:opacity-50"
        >
          {busy === "copy" ? "Copying…" : "Copy email"}
        </button>
      </div>
      {copied && (
        <div
          role="status"
          className="mt-1 flex w-[320px] flex-col items-start gap-2 rounded-xs border border-rule bg-sunk p-3"
        >
          <span className="text-caption text-muted">
            {copied.onClipboard
              ? "Email copied. Open a new message and paste it in (Ctrl+V)."
              : "Your browser blocked copying. Select this text and press Ctrl+C:"}
          </span>
          {!copied.onClipboard && (
            <textarea
              readOnly
              rows={8}
              value={copied.body}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-xs border border-rule bg-surface p-2 text-body-sm text-primary"
            />
          )}
          {/* In the order Gmail asks for them: address, then subject. */}
          {copied.to && (
            <span className="flex items-start gap-2 text-caption text-muted">
              <span>
                To: <span className="select-all font-mono text-data-sm text-secondary">{copied.to}</span>
              </span>
              <CopyIcon text={copied.to} label="email address" />
            </span>
          )}
          <span className="flex items-start gap-2 text-caption text-muted">
            <span>
              Subject: <span className="select-all text-secondary">{copied.subject}</span>
            </span>
            <CopyIcon text={copied.subject} label="subject" />
          </span>
          {copied.to ? (
            <>
              <a
                href={gmailCompose(copied)}
                target="_blank"
                rel="noreferrer"
                className="text-body-sm text-accent underline underline-offset-2"
              >
                Open a new Gmail message
              </a>
              {sent === "yes" ? (
                <span className="text-caption text-go">
                  ✓ Marked as sent. The follow-up clock has started.
                </span>
              ) : copied.alreadySent ? (
                // The same message, already marked sent: say when, rather than
                // offer the click again as if it had never happened.
                <span className="text-caption text-go">
                  ✓ Already marked sent {dayLabel(copied.alreadySent)}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={markSent}
                  disabled={sent === "saving"}
                  className="text-caption text-accent underline underline-offset-2 disabled:opacity-50"
                >
                  I sent it — start the follow-up clock
                </button>
              )}
            </>
          ) : (
            <span className="text-caption text-faint">
              No email address on file — paste it into their contact form or page instead.
            </span>
          )}
          <button
            type="button"
            onClick={async () => setCopied({ ...copied, onClipboard: await toClipboard(copied.body) })}
            className="text-caption text-secondary underline underline-offset-2 hover:text-primary"
          >
            copy the email again
          </button>
          {/*
            * No refresh until dismissed: a send sets the prospect to contacted,
            * the queue lists only new ones, and refreshing on the click would
            * pull this panel out from under the person reading it.
            */}
          <button
            type="button"
            onClick={() => {
              setCopied(null);
              if (sent === "yes") router.refresh();
              setSent("no");
            }}
            className="text-caption text-secondary underline underline-offset-2 hover:text-primary"
          >
            done
          </button>
        </div>
      )}
      {status && (
        <span className={`text-caption ${status.sent ? "text-go" : "text-hold"}`}>{status.text}</span>
      )}
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
