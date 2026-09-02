"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { setLeadStatus } from "../actions";

/**
 * The action row from Figma 3:1087: a primary "Draft email" carrying its
 * keyboard hint, with Archive and Flag beneath it.
 *
 * The same three actions the inbox exposes on `e`, `a` and `f`. Having them on
 * the detail page too is not duplication — the keyboard path is for clearing a
 * list quickly, and this is where a lead is read properly before deciding.
 */
export function LeadActions({ leadId, status }: { leadId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const act = (next: "parked" | "needs_draft") =>
    startTransition(async () => {
      await setLeadStatus(leadId, next);
      router.refresh();
    });

  return (
    <div className="max-w-prose">
      <a
        href={`/lead/${leadId}/draft`}
        className="flex items-center justify-between rounded-sm bg-accent px-5 py-3 text-body-sm text-on-accent transition-colors hover:bg-accent-hover"
      >
        Draft email
        <kbd className="rounded-xs border border-on-accent/30 px-2 py-0.5 font-mono text-data-sm">
          E
        </kbd>
      </a>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={pending || status === "parked"}
          onClick={() => act("parked")}
          className="rounded-sm border border-rule px-4 py-2 text-body-sm text-secondary transition-colors hover:bg-hovered disabled:opacity-50"
        >
          Archive
        </button>
        <button
          type="button"
          disabled={pending || status === "needs_draft"}
          onClick={() => act("needs_draft")}
          className="rounded-sm border border-rule px-4 py-2 text-body-sm text-secondary transition-colors hover:bg-hovered disabled:opacity-50"
        >
          Flag
        </button>
      </div>
    </div>
  );
}
