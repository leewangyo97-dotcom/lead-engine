import { Shell } from "@/app/components/shell";
import { OutcomeButtons } from "@/app/components/outcome-buttons";
import { ReplyRow } from "@/app/components/reply-row";
import { formatDay } from "@/lib/people/format";
import {
  ANSWERED,
  daysSince,
  gmailSearchUrl,
  messagedLeads,
  messagedProspects,
  whatsappChatUrl,
  type MessagedProspect,
} from "@/lib/places/replies";

export const dynamic = "force-dynamic";

const ago = (days: number) => (days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`);

function meta(p: MessagedProspect, now: Date): string {
  return [
    p.category,
    p.city,
    `${p.sends} ${p.sends === 1 ? "message" : "messages"} by ${p.channels.join(" and ")}`,
    `last ${formatDay(p.lastSentAt)} (${ago(daysSince(p.lastSentAt, now))})`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function Row({ p, now }: { p: MessagedProspect; now: Date }) {
  return (
    <ReplyRow
      id={p.id}
      name={p.name}
      meta={meta(p, now)}
      status={p.status}
      gmail={p.email ? gmailSearchUrl(p.email) : null}
      whatsapp={p.whatsapp ? whatsappChatUrl(p.whatsapp) : null}
    />
  );
}

/**
 * Everyone who was sent a message, and whether they answered.
 *
 * The app cannot read Gmail or WhatsApp, so answers only exist here once
 * someone marks them. This page lists every business messaged, oldest first,
 * with a one-click look at where an answer would be.
 */
export default async function RepliesPage() {
  const [prospectRows, leadRows] = await Promise.all([messagedProspects(), messagedLeads()]);
  const now = new Date();

  const waiting = prospectRows.filter((p) => p.status === "contacted");
  const answered = prospectRows.filter((p) => ANSWERED.includes(p.status));
  const declined = prospectRows.filter((p) => p.status === "do_not_contact");
  const leadsWaiting = leadRows.filter((l) => l.status === "sent");
  const leadsDone = leadRows.filter((l) => l.status !== "sent");
  const total = prospectRows.length + leadRows.length;

  return (
    <Shell current="/replies">
      <div className="mx-auto max-w-content">
        <h1 className="font-display text-heading-lg text-primary">Replies</h1>
        <p className="mt-2 max-w-prose text-body-sm text-muted">
          Everyone a message went to, oldest first. The app cannot read your inbox or WhatsApp,
          so an answer counts only once it is marked here. Check, then mark: the weekly review
          learns which messages work from these.
        </p>

        <div className="mt-6 flex flex-wrap gap-6 font-mono text-data-sm tabular-nums text-muted">
          <span className="text-primary">{total} messaged</span>
          <span>{waiting.length + leadsWaiting.length} waiting for an answer</span>
          <span className="text-go">{answered.length} answered</span>
          {declined.length > 0 && <span>{declined.length} asked not to be contacted</span>}
        </div>

        {total === 0 ? (
          <p className="mt-6 rounded-md border border-rule bg-surface p-5 text-body-sm text-secondary">
            Nothing has been sent yet. A message counts once &quot;I sent it&quot; is clicked.
          </p>
        ) : (
          <>
            <h2 className="mt-8 text-label text-secondary">Waiting for an answer</h2>
            {waiting.length + leadsWaiting.length === 0 ? (
              <p className="mt-2 text-body-sm text-muted">Nobody: every message has an answer marked.</p>
            ) : (
              <ul className="mt-3 rounded-md border border-rule bg-surface">
                {waiting.map((p) => (
                  <Row key={p.id} p={p} now={now} />
                ))}
                {leadsWaiting.map((l) => (
                  <li key={l.id} className="border-t border-rule-soft px-5 py-4 first:border-t-0">
                    <a href={`/lead/${l.id}`} className="text-primary hover:underline">
                      {l.company ?? "Job lead"} — {l.title}
                    </a>
                    <p className="mt-1 text-caption text-muted">
                      job application · last {formatDay(l.lastSentAt)} ({ago(daysSince(l.lastSentAt, now))})
                    </p>
                    <div className="mt-3">
                      <OutcomeButtons leadId={l.id} status={l.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {answered.length + leadsDone.length > 0 && (
              <details className="mt-8">
                <summary className="cursor-pointer text-label text-secondary">
                  Answered ({answered.length + leadsDone.length})
                </summary>
                <ul className="mt-3 rounded-md border border-rule bg-surface">
                  {answered.map((p) => (
                    <Row key={p.id} p={p} now={now} />
                  ))}
                  {leadsDone.map((l) => (
                    <li key={l.id} className="border-t border-rule-soft px-5 py-4 first:border-t-0">
                      <a href={`/lead/${l.id}`} className="text-primary hover:underline">
                        {l.company ?? "Job lead"} — {l.title}
                      </a>
                      <p className="mt-1 text-caption text-muted">job application · {l.status}</p>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}
