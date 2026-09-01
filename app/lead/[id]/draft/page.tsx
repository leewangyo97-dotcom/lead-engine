import { notFound } from "next/navigation";
import { getLead } from "@/lib/leads/queries";

export const dynamic = "force-dynamic";

/**
 * The draft review screen exists now so the triage keyboard has somewhere to
 * land, but it has nothing to show until Phase 5 builds the model layer.
 *
 * It is deliberately not a mock. A screen showing a plausible fake email would
 * be the single most dangerous thing in this repo — the whole point of the
 * verifier is that nothing unverified reaches a Gmail draft.
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
          No draft yet. Drafting arrives in Phase 5, along with the verifier that checks every
          factual claim against <code className="font-mono text-data">memory/PROFILE.md</code> before
          the Gmail button unlocks.
        </p>
        <p className="mt-4 text-body-sm text-muted">
          This lead is <span className="font-mono text-data">{lead.status}</span>. Press{" "}
          <kbd className="rounded-xs bg-sunk px-2 py-1 font-mono text-data-sm">f</kbd> in the inbox
          to flag it for drafting.
        </p>
      </div>

      <p className="mt-5 max-w-prose text-caption text-faint">
        There will never be a send button here. This system writes Gmail drafts and stops — that is a
        product decision, not a missing feature.
      </p>
    </main>
  );
}
