"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import type { InboxRow } from "@/lib/leads/queries";
import { setLeadStatus } from "../actions";
import { Pill, Score, TierStripe } from "./pills";

/** One-key disqualify reasons, per the spec's `x` shortcut. */
const REASONS = [
  { key: "1", value: "wrong_region", label: "wrong region" },
  { key: "2", value: "wrong_stack", label: "wrong stack" },
  { key: "3", value: "not_contract", label: "not contract" },
  { key: "4", value: "agency", label: "agency reseller" },
  { key: "5", value: "seniority", label: "seniority mismatch" },
];

const SHORTCUTS: [string, string][] = [
  ["j / k", "move"],
  ["enter", "open"],
  ["e", "draft"],
  ["a", "archive"],
  ["x", "disqualify"],
  ["f", "flag for draft"],
  ["?", "this help"],
];

function daysAgo(d: Date | null): string | null {
  if (!d) return null;
  const n = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (n <= 0) return "today";
  return n === 1 ? "1 day ago" : `${n} days ago`;
}

export function InboxList({ rows }: { rows: InboxRow[]; judged?: number }) {
  const router = useRouter();
  const [cursor, setCursor] = useState(0);
  const [askReason, setAskReason] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [pending, startTransition] = useTransition();
  const refs = useRef<(HTMLLIElement | null)[]>([]);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const current = rows[cursor];

  const act = useCallback(
    (status: "parked" | "disqualified" | "needs_draft", reason?: string) => {
      if (!current) return;
      startTransition(async () => {
        await setLeadStatus(current.id, status, reason);
        // Hold the index rather than the row: the acted-on row leaves the list,
        // so the next lead slides under the cursor and triage keeps its rhythm.
        setCursor((c) => Math.min(c, Math.max(0, rows.length - 2)));
      });
    },
    [current, rows.length],
  );

  useEffect(() => {
    refs.current[cursor]?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  // Move focus to an overlay when it opens. Without this the reason prompt —
  // which is one keystroke from disqualifying a lead — appears silently for
  // anyone using a screen reader, since nothing announces a panel that never
  // receives focus.
  useEffect(() => {
    if (askReason || showHelp) overlayRef.current?.focus();
  }, [askReason, showHelp]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Never hijack typing in a field.
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;

      if (askReason) {
        const match = REASONS.find((r) => r.key === e.key);
        if (match) {
          e.preventDefault();
          act("disqualified", match.value);
          setAskReason(false);
        } else if (e.key === "Escape") {
          setAskReason(false);
        }
        return;
      }

      switch (e.key) {
        case "j":
          e.preventDefault();
          setCursor((c) => Math.min(c + 1, rows.length - 1));
          break;
        case "k":
          e.preventDefault();
          setCursor((c) => Math.max(c - 1, 0));
          break;
        case "Enter":
          if (current) router.push(`/lead/${current.id}` as Route);
          break;
        case "e":
          if (current) router.push(`/lead/${current.id}/draft` as Route);
          break;
        case "a":
          e.preventDefault();
          act("parked");
          break;
        case "f":
          e.preventDefault();
          act("needs_draft");
          break;
        case "x":
          e.preventDefault();
          setAskReason(true);
          break;
        case "?":
          setShowHelp((s) => !s);
          break;
        case "Escape":
          setShowHelp(false);
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [act, askReason, current, router, rows.length]);

  // The empty case belongs to the page: Figma 3:1212 gives it a centred mark
  // and real numbers, which this component has no access to.
  if (!rows.length) return null;

  return (
    <>
      {/* Figma 3:874 "Leads List Box": 48px rows in one bordered box, separated
          by hairline rules. Not cards with gaps — the density is the point when
          the whole day is meant to clear in two minutes. */}
      <ul
        className="overflow-hidden rounded-md border border-rule bg-surface"
        aria-label="Leads to triage"
      >
        {rows.map((row, i) => {
          const active = i === cursor;
          return (
            <li
              key={row.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              aria-current={active}
              onClick={() => setCursor(i)}
              className={`flex cursor-pointer items-center gap-4 px-4 py-3 transition-colors ${
                i > 0 ? "border-t border-rule-soft" : ""
              } ${active ? "bg-selected" : "hover:bg-hovered"} ${
                pending && active ? "opacity-60" : ""
              }`}
            >
              <TierStripe tier={row.tier ?? "cold"} />
              <Score value={row.score} />

              <div className="min-w-0 flex-1">
                <Link
                  href={`/lead/${row.id}` as Route}
                  onClick={(e) => e.stopPropagation()}
                  className="text-subhead text-primary underline-offset-4 hover:underline"
                >
                  {row.company}
                </Link>
                <p className="truncate text-body-sm text-muted">{row.title}</p>
              </div>

              <div className="hidden shrink-0 items-center gap-4 sm:flex">
                <span className="font-mono text-data-sm tabular-nums text-secondary">
                  {row.payRaw ?? "rate unstated"} · {row.isContract ? "contract" : "full-time"}
                </span>
                {row.overlapHours != null && (
                  <span className="w-[80px] text-right font-mono text-data-sm tabular-nums text-go">
                    {row.overlapHours}h overlap
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {askReason && (
        <div
          ref={overlayRef}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          aria-label="Disqualify reason"
          className="fixed inset-x-0 bottom-0 border-t border-rule bg-surface p-5 shadow-overlay"
        >
          <p className="mb-3 text-label uppercase text-muted">Disqualify — pick a reason</p>
          <ul className="flex flex-wrap gap-4 text-body-sm text-secondary">
            {REASONS.map((r) => (
              <li key={r.key}>
                <kbd className="rounded-xs bg-sunk px-2 py-1 font-mono text-data-sm">{r.key}</kbd>{" "}
                {r.label}
              </li>
            ))}
            <li className="text-faint">
              <kbd className="rounded-xs bg-sunk px-2 py-1 font-mono text-data-sm">esc</kbd> cancel
            </li>
          </ul>
        </div>
      )}

      {showHelp && (
        <div
          ref={overlayRef}
          role="dialog"
          tabIndex={-1}
          aria-label="Keyboard shortcuts"
          className="fixed inset-x-0 bottom-0 border-t border-rule bg-surface p-5 shadow-overlay"
        >
          <p className="mb-3 text-label uppercase text-muted">Shortcuts</p>
          <ul className="flex flex-wrap gap-5 text-body-sm text-secondary">
            {SHORTCUTS.map(([k, label]) => (
              <li key={k}>
                <kbd className="rounded-xs bg-sunk px-2 py-1 font-mono text-data-sm">{k}</kbd> {label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
