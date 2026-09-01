import { notFound } from "next/navigation";
import { getLead } from "@/lib/leads/queries";
import { fromLead, prescore, type PrescoreResult } from "@/lib/scoring/prescore";
import { Pill } from "@/app/components/pills";
import { OutcomeButtons } from "@/app/components/outcome-buttons";

export const dynamic = "force-dynamic";

/**
 * Rubric line items, so a wrong score is diagnosable rather than mysterious.
 *
 * Two sets, because rubric 1.1.0 scores founder leads on different dimensions.
 * Showing the job maxima against funding parts produced "25 / 10" and
 * "18 / 5" — arithmetic that tells the reader the page is lying to them.
 */
const JOB_ROWS: [keyof PrescoreResult["parts"], string, number][] = [
  ["timezone", "Timezone eligibility", 30],
  ["contract", "Contract terms", 20],
  ["stack", "Stack match", 25],
  ["contact", "Direct contact", 10],
  ["pay", "Pay signal", 10],
  ["freshness", "Trigger freshness", 5],
];

const FUNDING_ROWS: [keyof PrescoreResult["parts"], string, number][] = [
  ["freshness", "Trigger freshness", 30],
  ["stack", "Stack match", 30],
  ["contact", "Direct contact", 25],
  ["pay", "Stage signal", 15],
];

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getLead(id);
  if (!row) notFound();

  const lead = row.leads;
  const stored = row.scores;
  // Recomputed rather than read back: the breakdown is deterministic, and
  // storing six more columns to avoid one function call would be worse.
  const computed = prescore(fromLead(lead));
  const rows = lead.kind === "funding" ? FUNDING_ROWS : JOB_ROWS;

  return (
    <main className="mx-auto max-w-content px-6 py-8">
      <a className="text-body-sm text-accent underline underline-offset-2" href="/">
        ← inbox
      </a>

      <header className="mb-8 mt-4 border-b border-rule pb-5">
        <h1
          className="font-display text-heading-lg text-primary"
          style={{ fontVariationSettings: "'opsz' 24, 'SOFT' 25, 'WONK' 0" }}
        >
          {lead.company}
        </h1>
        <p className="mt-2 text-body text-secondary">{lead.title}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {lead.isContract && <Pill tone="go">contract</Pill>}
          {lead.isDirect && <Pill tone="hold">direct</Pill>}
          <Pill>{lead.status}</Pill>
        </div>
      </header>

      <section className="mb-9">
        <h2 className="mb-5 text-label uppercase text-muted">Why it scored</h2>
        <table className="w-full max-w-prose text-body-sm">
          <tbody>
            {rows.map(([key, label, max]) => (
              <tr key={key} className="border-b border-rule-soft">
                <td className="py-3 text-secondary">{label}</td>
                <td className="py-3 text-right font-mono tabular-nums text-primary">
                  {computed.parts[key]} / {max}
                </td>
              </tr>
            ))}
            <tr>
              <td className="py-3 text-subhead text-primary">Total</td>
              <td className="py-3 text-right font-mono text-data-lg tabular-nums text-primary">
                {computed.score}
              </td>
            </tr>
          </tbody>
        </table>
        {stored && stored.preScore !== computed.score && (
          <p className="mt-3 max-w-prose text-caption text-hold">
            Stored score is {stored.preScore} under rubric {stored.rubricVer}; the figures above use
            the current rubric. They diverge because the weights changed after this lead was scored.
          </p>
        )}
      </section>

      <section className="mb-9">
        <h2 className="mb-5 text-label uppercase text-muted">The opening</h2>
        <dl className="max-w-prose text-body-sm">
          <div className="flex justify-between border-b border-rule-soft py-3">
            <dt className="text-secondary">Trigger</dt>
            <dd className="text-primary">{lead.triggerEvent ?? "none recorded"}</dd>
          </div>
          <div className="flex justify-between border-b border-rule-soft py-3">
            <dt className="text-secondary">Region</dt>
            <dd className="text-primary">{lead.region ?? "not stated"}</dd>
          </div>
          <div className="flex justify-between border-b border-rule-soft py-3">
            <dt className="text-secondary">Overlap with 09:00–18:00 Manila</dt>
            <dd className="font-mono tabular-nums text-primary">
              {lead.overlapHours != null ? `${lead.overlapHours}h` : "unknown"}
            </dd>
          </div>
          <div className="flex justify-between border-b border-rule-soft py-3">
            <dt className="text-secondary">Contact</dt>
            <dd className="text-primary">{lead.contact ?? "none in the posting"}</dd>
          </div>
          <div className="flex justify-between py-3">
            <dt className="text-secondary">Pay</dt>
            <dd className="font-mono tabular-nums text-primary">{lead.payRaw ?? "unstated"}</dd>
          </div>
        </dl>
        <p className="mt-4 max-w-prose text-caption text-faint">
          The angle and the proof points come from the copywriter in Phase 5. Nothing here is
          generated — every field above is read from the posting or computed from it.
        </p>
      </section>

      <section className="mb-9">
        <h2 className="mb-5 text-label uppercase text-muted">Outcome</h2>
        <OutcomeButtons leadId={lead.id} />
        <p className="mt-4 max-w-prose text-caption text-faint">
          Recorded by hand, because this system never sends. The weekly review can only be as honest
          as what is logged here — an unrecorded send makes every reply rate below it wrong.
        </p>
      </section>

      <section>
        <h2 className="mb-5 text-label uppercase text-muted">Source</h2>
        <p className="max-w-prose whitespace-pre-wrap text-body text-secondary">
          {lead.summary ?? "no summary captured"}
        </p>
        {lead.url && (
          <p className="mt-4">
            <a
              className="text-body-sm text-accent underline underline-offset-2"
              href={lead.url}
              target="_blank"
              rel="noreferrer noopener"
            >
              original posting ↗
            </a>
          </p>
        )}
        <p className="mt-4 text-caption text-faint">
          Summary is truncated to 400 characters at ingest, so this is the whole of what the system
          stores — not a preview of something longer.
        </p>
      </section>
    </main>
  );
}
