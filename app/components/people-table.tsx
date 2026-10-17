"use client";

import { useCallback, useState } from "react";
import { STATUSES, STATUS_LABEL, type PersonStatus } from "@/lib/people/status";
import { PersonDrawer } from "./person-drawer";
import { PersonEmail } from "./person-email";
import { ProspectDemo } from "./prospect-demo";
import { ProspectEnhance } from "./prospect-enhance";

export type SortKey = "score" | "name" | "company" | "added";

/** One row as the page hands it over: plain values, dates already formatted. */
export interface PersonView {
  id: string;
  name: string;
  title: string | null;
  seniority: string;
  email: string | null;
  emailStatus: string;
  phone: string | null;
  score: number | null;
  status: string;
  added: string;
  company: string;
  domain: string | null;
  industry: string | null;
  sizeBand: string | null;
  location: string | null;
  sources: string[];
  blocked: boolean;
  companyId: string;
  /** How many people their company has: "+N more" in the one-per-business view. */
  companyPeople: number;
  /** The local business behind their company, when there is one: Copy email writes about it. */
  prospectId: string | null;
  /** That business as Enhance and Make demo need it, read the way /prospects reads it. */
  business: {
    name: string;
    demoUrl: string | null;
    demoEligible: boolean;
    /** Why no demo can be made, when none can and none exists ("they already have a website"). */
    demoBlocked: string | null;
  } | null;
}

const SHORT_SOURCE: Record<string, string> = {
  website: "site",
  email_pattern: "pattern",
  edgar: "EDGAR",
  github: "GitHub",
  manual: "manual",
};

function StatusSelect({ person, onChange }: { person: PersonView; onChange: (next: Partial<PersonView>) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(status: PersonStatus) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/people/${person.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) onChange({ status, blocked: !!body.blocked });
      else setError(body.error ?? "not saved");
    } catch {
      setError("could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <select
        aria-label={`Status of ${person.name}`}
        value={person.status}
        disabled={busy}
        onChange={(e) => change(e.target.value as PersonStatus)}
        className="rounded-xs border border-rule bg-sunk px-2 py-1 text-body-sm text-primary disabled:opacity-50"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      {error && (
        <span role="alert" className="text-caption text-stop">
          {error}
        </span>
      )}
    </span>
  );
}

/**
 * Details and delete. Delete asks inline rather than through window.confirm,
 * like the do-not-contact question on /prospects, and the row goes at once:
 * no page reload.
 */
function RowActions({
  person,
  onOpen,
  onDeleted,
  onSent,
}: {
  person: PersonView;
  onOpen: () => void;
  onDeleted: () => void;
  onSent: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/people/${person.id}`, { method: "DELETE" });
      if (res.ok) onDeleted();
      else setError("not deleted");
    } catch {
      setError("could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  if (confirming) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2 text-body-sm">
        {/* Delete erases; it does not block. Discovery can find them again,
            and "Do not contact" is the status that keeps them out. */}
        <span className="text-secondary">
          Delete them and where they were found? Discovery may find them again; Do not contact keeps them out.
        </span>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="rounded-xs bg-stop px-2 py-1 text-on-accent disabled:opacity-50"
        >
          {busy ? "Deleting…" : "Yes, delete"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="text-secondary hover:text-primary">
          Cancel
        </button>
        {error && <span className="text-caption text-stop">{error}</span>}
      </span>
    );
  }
  // Who can be written to from here: someone at a local business who has not
  // said no, and whose address is on no list.
  const writable =
    !!person.prospectId && !person.blocked && person.status !== "do_not_contact" && person.status !== "not_interested";
  return (
    <span className="inline-flex flex-wrap items-start gap-4 text-body-sm">
      {/* Copy email writes to this person; Enhance and Make demo act on their
          business, exactly as on its /prospects row. */}
      {(writable || (person.prospectId && person.business)) && (
        <span className="flex flex-col items-start gap-2">
          {writable && <PersonEmail prospectId={person.prospectId!} personId={person.id} onSent={onSent} />}
          {person.prospectId && person.business && (
            <>
              <ProspectEnhance id={person.prospectId} name={person.business.name} />
              <ProspectDemo
                id={person.prospectId}
                demoUrl={person.business.demoUrl}
                eligible={person.business.demoEligible}
              />
              {/* A demo is a one-page site for a business with none, and its
                  email says so; discovery reads businesses that have a site.
                  Shown with the reason rather than missing without one. */}
              {person.business.demoBlocked && (
                <span className="text-caption text-faint" title="A demo is a free one-page site for a business that has none">
                  Make demo: no, {person.business.demoBlocked}
                </span>
              )}
            </>
          )}
        </span>
      )}
      <button type="button" onClick={onOpen} className="py-1 text-accent underline underline-offset-2">
        Details
      </button>
      <button type="button" onClick={() => setConfirming(true)} className="py-1 text-secondary hover:text-stop">
        Delete
      </button>
    </span>
  );
}

function Email({ p }: { p: PersonView }) {
  if (!p.email) return <span className="text-faint">—</span>;
  const guessed = p.emailStatus === "guessed";
  return (
    <span className="flex flex-col items-start gap-1">
      {/* A guess is shown for research and nothing else: not selectable here,
          never in an export, never behind a copy button. */}
      <span
        className={`font-mono text-data-sm ${guessed ? "select-none text-muted" : "text-secondary"} ${
          p.blocked ? "line-through" : ""
        }`}
      >
        {p.email}
      </span>
      <span
        className={`rounded-xs px-2 py-1 text-label ${
          p.blocked
            ? "bg-stop-tint text-stop"
            : guessed
              ? "bg-sunk text-faint"
              : "bg-go-tint text-go"
        }`}
      >
        {p.blocked ? "do not contact" : guessed ? "guessed · research only" : "verified"}
      </span>
    </span>
  );
}

function Score({ p }: { p: PersonView }) {
  const n = p.score ?? 0;
  return (
    <span
      className={`font-mono text-data-sm tabular-nums ${n >= 70 ? "text-go" : n >= 45 ? "text-primary" : "text-muted"}`}
    >
      {p.score ?? "—"}
    </span>
  );
}

/** "+3 more here": the rest of a business's people, in the one-per-business view. */
function MorePeople({ p, perBusiness }: { p: PersonView; perBusiness: boolean }) {
  if (!perBusiness || p.companyPeople < 2) return null;
  return (
    <a href={`/people?company=${p.companyId}`} className="mt-1 block text-caption text-accent underline underline-offset-2">
      +{p.companyPeople - 1} more here
    </a>
  );
}

export function PeopleTable({
  rows,
  sorts,
  seniorityLabel,
  perBusiness = false,
}: {
  rows: PersonView[];
  sorts: Record<SortKey, { href: string; mark: string }>;
  seniorityLabel: Record<string, string>;
  perBusiness?: boolean;
}) {
  const [changed, setChanged] = useState<Record<string, Partial<PersonView>>>({});
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const close = useCallback(() => setOpen(null), []);

  const visible = rows.filter((r) => !gone.has(r.id)).map((r) => ({ ...r, ...changed[r.id] }));
  const update = (id: string) => (next: Partial<PersonView>) =>
    setChanged((c) => ({ ...c, [id]: { ...c[id], ...next } }));
  const remove = (id: string) => () => setGone((g) => new Set(g).add(id));

  const sortable = (key: SortKey, label: string) => (
    <a href={sorts[key].href} className="hover:text-primary">
      {label}
      {sorts[key].mark}
    </a>
  );

  return (
    <>
      <ul className="mt-6 flex flex-col gap-3 md:hidden">
        {visible.map((p) => (
          <li key={p.id} className="rounded-md border border-rule bg-surface p-4">
            <div className="flex items-baseline gap-3">
              <Score p={p} />
              <span className="min-w-0 flex-1 text-primary">{p.name}</span>
            </div>
            <p className="mt-1 text-body-sm text-secondary">
              {p.title ?? seniorityLabel[p.seniority]} · {p.company}
            </p>
            <MorePeople p={p} perBusiness={perBusiness} />
            <div className="mt-2">
              <Email p={p} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <StatusSelect person={p} onChange={update(p.id)} />
              <RowActions
                person={p}
                onOpen={() => setOpen(p.id)}
                onDeleted={remove(p.id)}
                onSent={() => p.status === "new" && update(p.id)({ status: "contacted" })}
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 hidden overflow-x-auto rounded-md border border-rule bg-surface md:block">
        <table className="w-full min-w-[100rem] text-body-sm">
          <thead>
            <tr className="border-b border-rule text-label text-secondary">
              <th className="px-4 py-3 text-left font-normal">{sortable("score", "Score")}</th>
              <th className="px-4 py-3 text-left font-normal">{sortable("name", "Person")}</th>
              <th className="px-4 py-3 text-left font-normal">Seniority</th>
              <th className="px-4 py-3 text-left font-normal">{sortable("company", "Company")}</th>
              <th className="px-4 py-3 text-left font-normal">Industry</th>
              <th className="px-4 py-3 text-left font-normal">Size</th>
              <th className="px-4 py-3 text-left font-normal">Location</th>
              <th className="px-4 py-3 text-left font-normal">Email</th>
              <th className="px-4 py-3 text-left font-normal">Phone</th>
              <th className="px-4 py-3 text-left font-normal">Sources</th>
              <th className="px-4 py-3 text-left font-normal">Status</th>
              <th className="px-4 py-3 text-left font-normal">{sortable("added", "Added")}</th>
              <th className="px-4 py-3 text-left font-normal">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <tr key={p.id} className="border-t border-rule-soft align-top hover:bg-hovered">
                <td className="px-4 py-3">
                  <Score p={p} />
                </td>
                <td className="px-4 py-3">
                  <span className="text-primary">{p.name}</span>
                  <span className="mt-1 block text-caption text-muted">{p.title ?? "—"}</span>
                </td>
                <td className="px-4 py-3 text-secondary">{seniorityLabel[p.seniority] ?? p.seniority}</td>
                <td className="px-4 py-3">
                  <span className="text-primary">{p.company}</span>
                  <MorePeople p={p} perBusiness={perBusiness} />
                  {p.domain && (
                    <a
                      href={`https://${p.domain}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-1 block text-caption text-accent underline underline-offset-2"
                    >
                      {p.domain}
                    </a>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">{p.industry ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-data-sm text-muted">{p.sizeBand ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{p.location ?? "—"}</td>
                <td className="px-4 py-3">
                  <Email p={p} />
                </td>
                <td className="px-4 py-3 font-mono text-data-sm tabular-nums text-secondary">{p.phone ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-data-sm text-faint">
                  {p.sources.map((s) => SHORT_SOURCE[s] ?? s).join(" · ") || "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusSelect person={p} onChange={update(p.id)} />
                </td>
                <td className="px-4 py-3 font-mono text-data-sm text-muted">{p.added}</td>
                <td className="px-4 py-3">
                  <RowActions
                person={p}
                onOpen={() => setOpen(p.id)}
                onDeleted={remove(p.id)}
                onSent={() => p.status === "new" && update(p.id)({ status: "contacted" })}
              />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && <PersonDrawer id={open} onClose={close} />}
    </>
  );
}
