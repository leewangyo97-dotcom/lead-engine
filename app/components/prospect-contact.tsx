"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  id: string;
  whatsapp: { available: boolean; reason?: string };
  email: { available: boolean; reason?: string };
  contacted: boolean;
  declined: boolean;
}

/**
 * Opens a pre-filled WhatsApp chat or email, and records that it happened.
 *
 * The link comes from the server rather than being built here, so that what is
 * logged is exactly what is opened. It also lets the server refuse: a prospect
 * on the do-not-contact list must not be reachable by clicking faster.
 */
export function ProspectContact({ id, whatsapp, email, contacted, declined }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Confirmation is inline rather than a window.confirm: native dialogs are
  // suppressed in some mobile webviews, and a button that silently does nothing
  // is worse than one that asks. It needs asking — undoing this means editing
  // the suppression list by hand.
  const [confirming, setConfirming] = useState(false);

  async function markDeclined() {
    setBusy("decline");
    setError(null);
    try {
      const res = await fetch(`/api/prospects/${id}/decline`, { method: "POST" });
      if (!res.ok) setError("could not record that");
      else router.refresh();
    } catch {
      setError("could not reach the server");
    } finally {
      setBusy(null);
    }
  }

  async function open(channel: "whatsapp" | "email") {
    setBusy(channel);
    setError(null);

    // Opened before the await. A popup blocker only trusts a window opened in
    // the click's own turn, so the tab is claimed now and pointed afterwards.
    const tab = window.open("", "_blank");

    try {
      const res = await fetch(`/api/prospects/${id}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });
      const data = await res.json();

      if (!res.ok) {
        tab?.close();
        setError(data.error ?? "could not open");
        return;
      }

      if (tab) tab.location.href = data.href;
      else window.location.href = data.href;
      router.refresh();
    } catch {
      tab?.close();
      setError("could not reach the server");
    } finally {
      setBusy(null);
    }
  }

  if (declined) {
    return (
      <span title="On the do-not-contact list" className="text-body-sm text-faint">
        do not contact
      </span>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => open("whatsapp")}
          disabled={!whatsapp.available || busy !== null}
          title={whatsapp.available ? "Open WhatsApp with a first message ready" : whatsapp.reason}
          className="rounded-xs border border-go px-3 py-1 text-body-sm text-go hover:bg-go-tint disabled:cursor-not-allowed disabled:border-rule disabled:text-faint disabled:hover:bg-transparent"
        >
          {busy === "whatsapp" ? "Opening…" : "WhatsApp"}
        </button>
        <button
          type="button"
          onClick={() => open("email")}
          disabled={!email.available || busy !== null}
          title={email.available ? "Open a draft email" : email.reason}
          className="rounded-xs border border-rule px-3 py-1 text-body-sm text-secondary hover:bg-hovered disabled:cursor-not-allowed disabled:text-faint disabled:hover:bg-transparent"
        >
          {busy === "email" ? "Opening…" : "Email"}
        </button>
      </div>

      {confirming ? (
        <span className="flex items-center gap-2 text-caption">
          <span className="text-muted">Add their number, email and domain to the list?</span>
          <button
            type="button"
            onClick={markDeclined}
            disabled={busy !== null}
            className="text-stop underline underline-offset-2 disabled:opacity-50"
          >
            {busy === "decline" ? "saving…" : "yes"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-secondary underline underline-offset-2"
          >
            cancel
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          title="They asked not to be contacted"
          className="text-caption text-faint underline underline-offset-2 hover:text-secondary"
        >
          they said no
        </button>
      )}

      {contacted && <span className="text-caption text-muted">contacted</span>}
      {!whatsapp.available && whatsapp.reason && (
        <span className="text-caption text-faint">{whatsapp.reason}</span>
      )}
      {error && (
        <span role="alert" className="text-caption text-stop">
          {error}
        </span>
      )}
    </div>
  );
}
