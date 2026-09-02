"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  id: string;
  whatsapp: { available: boolean; reason?: string };
  email: { available: boolean; reason?: string };
  contacted: boolean;
}

/**
 * Opens a pre-filled WhatsApp chat or email, and records that it happened.
 *
 * The link comes from the server rather than being built here, so that what is
 * logged is exactly what is opened. It also lets the server refuse: a prospect
 * on the do-not-contact list must not be reachable by clicking faster.
 */
export function ProspectContact({ id, whatsapp, email, contacted }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
