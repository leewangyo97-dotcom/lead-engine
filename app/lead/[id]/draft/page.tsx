import { notFound } from "next/navigation";
import { getLead } from "@/lib/leads/queries";
import { NEEDS_DRAFT_THRESHOLD } from "@/lib/scoring/prescore";

export const dynamic = "force-dynamic";

/**
 * Shows the draft for a lead, once one exists.
 *
 * Deliberately not a mock. A screen showing a plausible fake email would be the
 * single most dangerous thing in this repo — the whole point of the verifier is
 * that nothing unverified reaches a Gmail draft, and a convincing placeholder is
 * an unverified claim rendered convincingly.
 */
export default async function DraftReview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getLead(id);
  if (!row) notFound();

  const lead = row.leads;

  return (
    <main className="mx-auto max-w-content px-6 py-8">
      <a className="text-body-sm text-accent underline underline-offset-2" href={`/lead/${id}`}>
        ← {lead.company}
      </a>

      <h1
        className="mt-4 font-display text-heading-lg text-primary"
        style={{ fontVariationSettings: "'opsz' 24, 'SOFT' 25, 'WONK' 0" }}
      >
        Draft review
      </h1>

      <div className="mt-7 max-w-prose rounded-md border border-rule bg-surface p-7">
        <p className="text-body text-secondary">
          No draft yet. Run <code className="font-mono text-data">/daily-run</code> in Claude Code:
          it scores, drafts, and puts every factual claim past the verifier — which checks each one
          against <code className="font-mono text-data">memory/PROFILE.md</code> before a Gmail
          draft can be created.
        </p>
        <p className="mt-4 text-body-sm text-muted">
          This lead is <span className="font-mono text-data">{lead.status}</span>. A draft is only
          written for leads scoring {NEEDS_DRAFT_THRESHOLD} or above; press{" "}
          <kbd className="rounded-xs bg-sunk px-2 py-1 font-mono text-data-sm">f</kbd> in the inbox
          to flag this one for drafting regardless.
        </p>
      </div>

      <p className="mt-5 max-w-prose text-caption text-faint">
        There will never be a send button here. This system writes Gmail drafts and stops — that is a
        product decision, not a missing feature.
      </p>
    </main>
  );
}
