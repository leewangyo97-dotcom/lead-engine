import { notFound } from "next/navigation";
import { getLead } from "@/lib/leads/queries";
import { getDraft } from "@/lib/leads/draft-query";
import { NEEDS_DRAFT_THRESHOLD } from "@/lib/scoring/prescore";
import { Shell } from "@/app/components/shell";

export const dynamic = "force-dynamic";

/**
 * Draft review, from Figma 3:1098 `Review Generated Draft`.
 *
 * Deliberately not a mock when there is no draft. A screen showing a plausible
 * fake email is the most dangerous thing that could be in this repo — the whole
 * point of the verifier is that no unverified claim reaches a Gmail draft, and a
 * convincing placeholder is an unverified claim rendered convincingly.
 *
 * One departure from the design, and it is not negotiable: that frame labels the
 * primary button "Send to Gmail". This system creates drafts and stops. There is
 * no send path anywhere in the repo (CLAUDE.md rule 2), so the button says what
 * it actually does.
 */

/** Splits a body around the verifier's quoted text so it can be marked inline. */
function highlight(body: string, quotes: string[]) {
  if (!quotes.length) return [{ text: body, flagged: false }];

  const found = quotes.filter((q) => body.includes(q));
  if (!found.length) return [{ text: body, flagged: false }];

  const pattern = found
    .map((q) => q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length)
    .join("|");

  return body
    .split(new RegExp(`(${pattern})`, "g"))
    .filter(Boolean)
    .map((text) => ({ text, flagged: found.includes(text) }));
}

export default async function DraftReview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getLead(id);
  if (!row) notFound();

  const lead = row.leads;
  const draft = await getDraft(id);
  const issues = draft?.violations.length ?? 0;

  return (
    <Shell current="/">
      <div className="mx-auto max-w-content">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1
            className="font-display text-heading-lg text-primary"
            style={{ fontVariationSettings: "'opsz' 24, 'SOFT' 25, 'WONK' 0" }}
          >
            Review generated draft
          </h1>
          {issues > 0 && (
            <span className="rounded-xs bg-stop-tint px-3 py-1 text-label uppercase text-stop">
              {issues} issue{issues === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <p className="mt-2 text-body-sm text-muted">
          <a className="text-accent underline underline-offset-2" href={`/lead/${id}`}>
            {lead.company}
          </a>{" "}
          · {lead.title}
        </p>

        {!draft ? (
          <div className="mt-7 max-w-prose rounded-md border border-rule bg-surface p-7">
            <p className="text-body text-secondary">
              No draft yet. Run <code className="font-mono text-data">/daily-run</code> in Claude
              Code: it scores, drafts, and puts every factual claim past the verifier before a Gmail
              draft can be created.
            </p>
            <p className="mt-4 text-body-sm text-muted">
              This lead is <span className="font-mono text-data">{lead.status}</span>. A draft is
              only written for leads scoring {NEEDS_DRAFT_THRESHOLD} or above; press{" "}
              <kbd className="rounded-xs bg-sunk px-2 py-1 font-mono text-data-sm">f</kbd> in the
              inbox to flag this one regardless.
            </p>
          </div>
        ) : (
          <div className="mt-6 rounded-md border border-rule bg-surface p-6">
            {draft.violations.map((v) => (
              <div
                key={`${v.type}-${v.quote}`}
                role="alert"
                className="mb-4 rounded-sm border border-stop bg-stop-tint p-4"
              >
                <p className="text-subhead text-stop">{v.type.replace(/_/g, " ")}</p>
                <p className="mt-1 text-body-sm text-primary">{v.fix}</p>
              </div>
            ))}

            <p className="text-label uppercase text-muted">Subject</p>
            <p className="mt-2 rounded-sm border border-rule bg-sunk px-4 py-3 text-body text-primary">
              {draft.subject}
            </p>

            <p className="mt-5 text-label uppercase text-muted">Email body</p>
            <div className="mt-2 max-w-prose whitespace-pre-wrap rounded-sm border border-rule bg-sunk px-4 py-3 text-body text-secondary">
              {highlight(
                draft.body,
                draft.violations.map((v) => v.quote),
              ).map((part, i) =>
                part.flagged ? (
                  <mark
                    key={i}
                    className="border-l-2 border-stop bg-stop-tint pl-2 font-medium text-primary"
                  >
                    {part.text}
                  </mark>
                ) : (
                  <span key={i}>{part.text}</span>
                ),
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span
                aria-disabled={draft.verifiedAt == null}
                className={`rounded-sm px-5 py-3 text-body-sm ${
                  draft.gmailDraftId
                    ? "border border-go text-go"
                    : draft.verifiedAt
                      ? "bg-accent text-on-accent"
                      : "cursor-not-allowed bg-sunk text-faint"
                }`}
              >
                {draft.gmailDraftId
                  ? "In Gmail"
                  : draft.verifiedAt
                    ? "Ready — run pnpm gmail:drafts"
                    : "Create Gmail draft — blocked until verified"}
              </span>
              {draft.angle && (
                <span className="font-mono text-data-sm text-muted">
                  angle: {draft.angle}
                  {draft.proofUsed?.length ? ` · proof: ${draft.proofUsed.join(", ")}` : ""}
                </span>
              )}
            </div>
          </div>
        )}

        <p className="mt-5 max-w-prose text-caption text-faint">
          There will never be a send button here. This system writes Gmail drafts and stops — a
          product decision, not a missing feature. The design frame labels this &ldquo;Send to
          Gmail&rdquo;; it does not send, so it does not say so.
        </p>
      </div>
    </Shell>
  );
}
