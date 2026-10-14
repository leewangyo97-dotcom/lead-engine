"use client";

import { useEffect, useState } from "react";
import { formatDay } from "@/lib/people/format";
import { SENIORITY_LABEL, type Seniority } from "@/lib/people/seniority";
import { STATUS_LABEL, type PersonStatus } from "@/lib/people/status";

interface Source {
  id: string;
  personId: string | null;
  field: string;
  value: string | null;
  sourceUrl: string | null;
  sourceType: string;
  fetchedAt: string;
}

interface Detail {
  name: string;
  title: string | null;
  seniority: string;
  email: string | null;
  emailStatus: string;
  phone: string | null;
  linkedinUrl: string | null;
  score: number | null;
  scoreReasons: Record<string, number> | null;
  status: string;
  notes: string | null;
  company: string;
  domain: string | null;
  industry: string | null;
  sizeBand: string | null;
  location: string | null;
  signals: Record<string, unknown> | null;
  blocked: boolean;
  sources: Source[];
}

export const SOURCE_LABEL: Record<string, string> = {
  website: "Company website",
  email_pattern: "Email pattern (a guess)",
  edgar: "SEC EDGAR Form D",
  github: "GitHub",
  manual: "Added by hand",
};

/** "companySize" reads "company size": reasons and signals without a lookup table to drift. */
export const words = (key: string) => key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").toLowerCase();

const host = (url: string) => {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return url;
  }
};

function signalText(key: string, value: unknown): string | null {
  if (value === true) return words(key);
  if (Array.isArray(value)) return value.length ? `${words(key)}: ${value.join(", ")}` : null;
  if (typeof value === "string" || typeof value === "number") return `${words(key)}: ${value}`;
  if (value && typeof value === "object") {
    const parts = Object.entries(value).filter(([, v]) => v !== null && v !== undefined);
    return parts.length ? `${words(key)}: ${parts.map(([k, v]) => `${words(k)} ${v}`).join(", ")}` : null;
  }
  return null;
}

/**
 * One person, and where every fact about them came from. The sources are the
 * point: a name, a title or an address nobody can trace back to a public page
 * is not something to act on, and it is what a "where did you get my details"
 * question needs answered.
 */
export function PersonDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/people/${id}`, { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!live) return;
        if (!res.ok) setError(body.error ?? "could not load them");
        else {
          setData(body);
          setNotes(body.notes ?? "");
        }
      })
      .catch(() => live && setError("could not reach the server"));
    return () => {
      live = false;
    };
  }, [id]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  async function saveNotes() {
    setSaved(null);
    const res = await fetch(`/api/people/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    }).catch(() => null);
    setSaved(res?.ok ? "Saved" : "Not saved — try again");
  }

  const byField = new Map<string, Source[]>();
  for (const s of data?.sources ?? []) byField.set(s.field, [...(byField.get(s.field) ?? []), s]);
  const signals = Object.entries(data?.signals ?? {})
    .map(([k, v]) => signalText(k, v))
    .filter((s): s is string => !!s);
  const guessed = data?.emailStatus === "guessed";
  // Copying is the first step of contacting someone, so it gets the same
  // checks as an export: a verified address, nobody on the list.
  const copyable = !!data?.email && data.emailStatus === "verified" && !data.blocked && data.status !== "do_not_contact";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={data ? `Details for ${data.name}` : "Details"}
      className="fixed inset-0 z-50 flex justify-end bg-canvas/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-rule bg-surface p-7 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-heading-md text-primary">{data?.name ?? "Loading…"}</p>
            {data && (
              <p className="mt-1 text-body-sm text-secondary">
                {data.title ?? "No title found"} · {data.company}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-body-sm text-secondary hover:text-primary">
            Close
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-5 text-body-sm text-stop">
            {error}
          </p>
        )}

        {data && (
          <>
            <dl className="mt-6 grid grid-cols-[9rem_1fr] gap-x-4 gap-y-3 text-body-sm">
              <dt className="text-label text-secondary">Score</dt>
              <dd className="text-primary">
                <span className="font-mono tabular-nums">{data.score ?? "—"}</span>
                {data.scoreReasons && (
                  <span className="ml-2 text-caption text-muted">
                    {Object.entries(data.scoreReasons)
                      .filter(([, v]) => v > 0)
                      .map(([k, v]) => `${words(k)} +${v}`)
                      .join(" · ")}
                  </span>
                )}
              </dd>

              <dt className="text-label text-secondary">Seniority</dt>
              <dd className="text-primary">{SENIORITY_LABEL[data.seniority as Seniority] ?? data.seniority}</dd>

              <dt className="text-label text-secondary">Status</dt>
              <dd className="text-primary">
                {STATUS_LABEL[data.status as PersonStatus] ?? data.status}
                {data.blocked && (
                  <span className="ml-2 rounded-xs bg-stop-tint px-2 py-1 text-label text-stop">
                    on the do-not-contact list
                  </span>
                )}
              </dd>

              <dt className="text-label text-secondary">Email</dt>
              <dd>
                {data.email ? (
                  <>
                    <span className={`font-mono text-data-sm ${guessed ? "select-none text-muted" : "text-primary"}`}>
                      {data.email}
                    </span>
                    <span
                      className={`ml-2 rounded-xs px-2 py-1 text-label ${
                        guessed ? "bg-sunk text-faint" : "bg-go-tint text-go"
                      }`}
                    >
                      {guessed ? "guessed · research only" : "verified · on their website"}
                    </span>
                    {copyable && (
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(data.email!).catch(() => undefined);
                          setCopied(true);
                        }}
                        className="ml-2 text-caption text-accent underline underline-offset-2"
                      >
                        {copied ? "Copied" : "Copy"}
                      </button>
                    )}
                    {guessed && (
                      <p className="mt-1 text-caption text-muted">
                        Built from the address pattern their site uses. It is never copied, exported or
                        sent: confirm it on a public page first.
                      </p>
                    )}
                  </>
                ) : (
                  <span className="text-faint">None found</span>
                )}
              </dd>

              <dt className="text-label text-secondary">Phone</dt>
              <dd className="font-mono text-data-sm text-primary">{data.phone ?? <span className="text-faint">—</span>}</dd>

              {data.linkedinUrl && (
                <>
                  <dt className="text-label text-secondary">LinkedIn</dt>
                  <dd>
                    <a
                      href={data.linkedinUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-accent underline underline-offset-2"
                    >
                      Profile (a link from their site; LinkedIn is never read)
                    </a>
                  </dd>
                </>
              )}

              <dt className="text-label text-secondary">Company</dt>
              <dd className="text-primary">
                {data.company}
                {data.domain && (
                  <a
                    href={`https://${data.domain}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="ml-2 text-accent underline underline-offset-2"
                  >
                    {data.domain}
                  </a>
                )}
                <span className="mt-1 block text-caption text-muted">
                  {[data.industry, data.sizeBand && `${data.sizeBand} people`, data.location].filter(Boolean).join(" · ") ||
                    "Industry, size and location not found"}
                </span>
              </dd>

              {signals.length > 0 && (
                <>
                  <dt className="text-label text-secondary">Signals</dt>
                  <dd className="text-body-sm text-secondary">{signals.join(" · ")}</dd>
                </>
              )}
            </dl>

            <h2 className="mt-8 text-label text-secondary">Where each fact came from</h2>
            {byField.size === 0 ? (
              <p className="mt-2 text-body-sm text-muted">No sources recorded.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-4">
                {[...byField.entries()].map(([field, list]) => (
                  <li key={field} className="border-t border-rule-soft pt-3">
                    <p className="text-label text-primary">{words(field)}</p>
                    {list.map((s) => (
                      <p key={s.id} className="mt-1 text-caption text-muted">
                        {s.value && <span className="text-secondary">{s.value.slice(0, 160)} · </span>}
                        {SOURCE_LABEL[s.sourceType] ?? s.sourceType}
                        {s.personId === null && " (company)"}
                        {s.sourceUrl && (
                          <>
                            {" · "}
                            <a
                              href={s.sourceUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-accent underline underline-offset-2"
                            >
                              {host(s.sourceUrl)}
                            </a>
                          </>
                        )}
                        {" · "}
                        {formatDay(s.fetchedAt)}
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
            )}

            <label htmlFor="person-notes" className="mt-8 block text-label text-secondary">
              Notes
            </label>
            <textarea
              id="person-notes"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setSaved(null);
              }}
              rows={3}
              maxLength={2000}
              className="mt-2 w-full rounded-sm border border-rule bg-sunk px-4 py-3 text-body-sm text-primary"
            />
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={saveNotes}
                className="rounded-xs border border-rule px-3 py-1 text-body-sm text-secondary hover:bg-hovered"
              >
                Save notes
              </button>
              {saved && <span className="text-caption text-muted">{saved}</span>}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
