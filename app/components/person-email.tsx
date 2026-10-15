"use client";

import { useState } from "react";
import { CopiedPanel, toClipboard, type Copied } from "./prospect-row-actions";

/**
 * Copy email for one decision-maker: the same panel as /prospects, written to
 * this person at their business (`?person=`). It greets them by name, and
 * goes to their own address when it is verified; a guessed one is never used.
 * A sequence already begun with someone at the business continues with them.
 *
 * Only for people at a local business: those are the emails the app writes.
 * Nothing is recorded until "I sent it", as on /prospects.
 */
export function PersonEmail({
  prospectId,
  personId,
  onSent,
}: {
  prospectId: string;
  personId: string;
  onSent?: () => void;
}) {
  const url = `/api/prospects/${prospectId}/message?person=${encodeURIComponent(personId)}`;
  const [copied, setCopied] = useState<Copied | null>(null);
  const [sent, setSent] = useState<"no" | "saving" | "yes">("no");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function copyEmail() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(url);
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
      setBusy(false);
    }
  }

  async function markSent() {
    setSent("saving");
    try {
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSent("yes");
        onSent?.();
      } else {
        setSent("no");
        setNote(data.error ?? "could not mark it sent");
      }
    } catch {
      setSent("no");
      setNote("could not reach the server");
    }
  }

  return (
    <span className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={copyEmail}
        disabled={busy}
        title="Copy a short, plain-English email to this person, ready to paste into Gmail"
        className="rounded-xs border border-rule px-3 py-1 text-body-sm text-secondary hover:bg-hovered disabled:opacity-50"
      >
        {busy ? "Copying…" : "Copy email"}
      </button>
      {copied && (
        <CopiedPanel
          copied={copied}
          sent={sent}
          onMarkSent={markSent}
          onCopyAgain={async () => setCopied({ ...copied, onClipboard: await toClipboard(copied.body) })}
          onDone={() => {
            setCopied(null);
            setSent("no");
          }}
        />
      )}
      {note && <span className="text-caption text-muted">{note}</span>}
    </span>
  );
}
