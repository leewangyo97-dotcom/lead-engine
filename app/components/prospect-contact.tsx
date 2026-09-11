"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  id: string;
  whatsapp: { available: boolean; reason?: string; confidence?: "confirmed" | "likely" };
  email: { available: boolean; reason?: string };
  contacted: boolean;
  declined: boolean;
  /** The prospect's own status: with no events table, it is the whole record. */
  status: string;
}

/**
 * Opens a pre-filled WhatsApp chat or email, and records that it happened.
 *
 * The link comes from the server rather than being built here, so that what is
 * logged is exactly what is opened. It also lets the server refuse: a prospect
 * on the do-not-contact list must not be reachable by clicking faster.
 */
export function ProspectContact({ id, whatsapp, email, contacted, declined, status }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Confirmation is inline rather than a window.confirm: native dialogs are
  // suppressed in some mobile webviews, and a button that silently does nothing
  // is worse than one that asks. It needs asking — undoing this means editing
  // the suppression list by hand.
  const [confirming, setConfirming] = useState(false);
  // Held open until dismissed, for email only. See `open`.
  const [sent, setSent] = useState<{
    href: string;
    to?: string;
    mode?: "gmail-draft" | "mailto" | "whatsapp";
    gmailError?: string;
  } | null>(null);
  const [marked, setMarked] = useState(false);

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

  /**
   * Records the outreach, then hands over whatever the server said to open.
   *
   * WhatsApp opens a tab, because wa.me is a web page and always loads. Email
   * cannot be treated the same way, and two attempts at it were both wrong.
   *
   * A mailto: set on a blank popup is ignored by browsers. Setting it on the
   * current window is ignored too when no mail client is registered — silently,
   * with no event to detect it. The fallback address that was meant to cover
   * that never appeared either, because `router.refresh()` ran in the same
   * breath: logging a contact sets the prospect to `contacted`, the top-25
   * queue only lists `new`, so the row this component lives in was removed from
   * the page and took the address with it.
   *
   * The visible result was a button that did nothing while quietly spending a
   * prospect: the send logged, no mail window, no address, and the row gone.
   *
   * So email holds the row open instead. The panel carries a real anchor — a
   * link the person clicks is the reliable way to reach a mail handler, unlike
   * an assignment the browser may drop — and the address beside it, and nothing
   * refreshes until they say they are done.
   */
  async function open(channel: "whatsapp" | "email") {
    setBusy(channel);
    setError(null);
    setSent(null);

    // A popup blocker only trusts a window opened in the click's own turn, so
    // this cannot wait for the await.
    const tab = channel === "whatsapp" ? window.open("", "_blank") : null;

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

      if (channel === "whatsapp") {
        if (tab) tab.location.href = data.href;
        else window.location.href = data.href;
        router.refresh();
        return;
      }

      setSent({ href: data.href, to: data.to, mode: data.mode, gmailError: data.gmailError });
    } catch {
      tab?.close();
      setError("could not reach the server");
    } finally {
      setBusy(null);
    }
  }

  async function undecline() {
    setBusy("undecline");
    setError(null);
    try {
      const res = await fetch(`/api/prospects/${id}/undecline`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "could not undo that");
        return;
      }
      // An identifier another declined business also owns stays on the list, so
      // the row can come back and still be unreachable. Saying so beats letting
      // someone discover it by clicking WhatsApp and being refused.
      if (data.kept?.length) {
        setError(
          `Back in the queue, but ${data.kept.length} identifier(s) stay suppressed — another ` +
            "declined business shares them.",
        );
      }
      router.refresh();
    } catch {
      setError("could not reach the server");
    } finally {
      setBusy(null);
    }
  }

  if (declined) {
    return (
      <span className="flex flex-col items-start gap-1">
        <span className="flex items-center gap-2">
          <span title="On the do-not-contact list" className="text-body-sm text-faint">
            do not contact
          </span>
          <button
            type="button"
            onClick={undecline}
            disabled={busy !== null}
            title="Put them back in the queue and take their details off the list"
            className="text-caption text-secondary underline underline-offset-2 hover:text-primary disabled:opacity-50"
          >
            {busy === "undecline" ? "undoing…" : "undo"}
          </button>
        </span>
        {error && (
          <span role="alert" className="text-caption text-hold">
            {error}
          </span>
        )}
      </span>
    );
  }

  async function record(outcome: string) {
    setBusy(outcome);
    setError(null);
    try {
      const res = await fetch(`/api/prospects/${id}/outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      if (!res.ok) setError("could not record that");
      else router.refresh();
    } catch {
      setError("could not reach the server");
    } finally {
      setBusy(null);
    }
  }

  const answered = status === "replied" || status === "won" || status === "lost";

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-2">
        {/* Confirmed and likely look different, because they are.
            Confirmed means the business published a wa.me link; likely means the
            number merely classifies as mobile, which is reliable here and a coin
            toss in the United States. Nobody can ask WhatsApp whether a number
            is registered, so the button says which of the two it is rather than
            implying the same certainty for both. */}
        <button
          type="button"
          onClick={() => open("whatsapp")}
          disabled={!whatsapp.available || busy !== null}
          title={
            !whatsapp.available
              ? whatsapp.reason
              : whatsapp.confidence === "confirmed"
                ? "They publish this WhatsApp number — opens with a first message ready"
                : "Mobile number, so probably on WhatsApp. Not confirmed by them."
          }
          className={`rounded-xs border px-3 py-1 text-body-sm disabled:cursor-not-allowed disabled:border-rule disabled:text-faint disabled:hover:bg-transparent ${
            whatsapp.confidence === "confirmed"
              ? "border-go text-go hover:bg-go-tint"
              : "border-rule text-secondary hover:bg-hovered"
          }`}
        >
          {busy === "whatsapp" ? "Opening…" : "WhatsApp"}
          {whatsapp.available && (
            <span
              aria-hidden="true"
              className={`ml-1 font-mono text-data-sm ${
                whatsapp.confidence === "confirmed" ? "text-go" : "text-faint"
              }`}
            >
              {whatsapp.confidence === "confirmed" ? "✓" : "?"}
            </span>
          )}
          <span className="sr-only">
            {whatsapp.available
              ? whatsapp.confidence === "confirmed"
                ? " (confirmed)"
                : " (unconfirmed)"
              : ""}
          </span>
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

      {/* Outcomes only after a message has gone out: there is nothing to record
          about a conversation that never started. */}
      {contacted && !answered && (
        <span className="flex flex-wrap items-center gap-2 text-caption">
          <span className="text-muted">contacted — </span>
          {(["replied", "won", "lost"] as const).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => record(o)}
              disabled={busy !== null}
              className="text-secondary underline underline-offset-2 hover:text-primary disabled:opacity-50"
            >
              {busy === o ? "…" : o}
            </button>
          ))}
        </span>
      )}

      {answered && (
        <span className="flex items-center gap-2 text-caption">
          <span className={status === "lost" ? "text-muted" : "text-go"}>{status}</span>
          <button
            type="button"
            onClick={() => record("reopen")}
            disabled={busy !== null}
            className="text-faint underline underline-offset-2 hover:text-secondary disabled:opacity-50"
          >
            undo
          </button>
        </span>
      )}
      {!whatsapp.available && whatsapp.reason && (
        <span className="text-caption text-faint">{whatsapp.reason}</span>
      )}
      {sent && (
        <div className="mt-1 flex flex-col items-start gap-1 rounded-xs border border-rule bg-sunk p-3">
          {sent.mode === "gmail-draft" ? (
            <>
              {/*
                * Nothing has been sent, and the panel says so in those words.
                * The draft is in the account; pressing send is still a person's
                * act, and until they say they did it the row carries no sentAt
                * and the follow-up ladder has not started.
                */}
              <span className="text-caption text-muted">
                Draft created in Gmail. Nothing has been sent.
              </span>
              <a
                href="https://mail.google.com/mail/u/0/#drafts"
                target="_blank"
                rel="noreferrer"
                className="text-body-sm text-accent underline underline-offset-2"
              >
                Open your Gmail drafts
              </a>
              {marked ? (
                <span className="text-caption text-muted">Marked as sent.</span>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    const res = await fetch(`/api/prospects/${id}/sent`, { method: "POST" });
                    if (res.ok) setMarked(true);
                    else setError((await res.json()).error ?? "could not mark it sent");
                  }}
                  className="text-caption text-accent underline underline-offset-2"
                >
                  I sent it — start the follow-up clock
                </button>
              )}
            </>
          ) : (
            <>
              <span className="text-caption text-muted">
                {sent.gmailError
                  ? "Gmail was unavailable, so this is a mail-app link. Logged as sent."
                  : "Logged. Open it in your mail app:"}
              </span>
              <a href={sent.href} className="text-body-sm text-accent underline underline-offset-2">
                Compose the email
              </a>
              {sent.to && (
                <span className="text-caption text-muted">
                  or write to{" "}
                  <span className="font-mono text-data-sm text-secondary">{sent.to}</span>
                </span>
              )}
              {sent.gmailError && (
                <span className="text-caption text-faint">{sent.gmailError}</span>
              )}
            </>
          )}
          <button
            type="button"
            onClick={() => {
              setSent(null);
              setMarked(false);
              router.refresh();
            }}
            className="text-caption text-secondary underline underline-offset-2 hover:text-primary"
          >
            done
          </button>
        </div>
      )}

      {error && (
        <span role="alert" className="text-caption text-stop">
          {error}
        </span>
      )}
    </div>
  );
}
