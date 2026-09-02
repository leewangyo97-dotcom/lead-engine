import { Shell } from "@/app/components/shell";
import { ProspectSearchForm } from "@/app/components/prospect-search-form";
import { ProspectContact } from "@/app/components/prospect-contact";
import { ProspectEnhance } from "@/app/components/prospect-enhance";
import {
  ProspectRowActions,
  RefreshAllButton,
} from "@/app/components/prospect-row-actions";
import {
  getProspectStats,
  getProspects,
  getSearch,
  getTopProspects,
  listSearches,
} from "@/lib/places/prospect-queries";

export const dynamic = "force-dynamic";

function Channel({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      title={ok ? `${label} available` : `no ${label.toLowerCase()}`}
      className={`rounded-xs px-2 py-0.5 text-label uppercase ${
        ok ? "bg-go-tint text-go" : "bg-sunk text-faint"
      }`}
    >
      {label}
    </span>
  );
}

export default async function Prospects({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search: searchId } = await searchParams;
  const recent = await listSearches();
  const active = searchId ? await getSearch(searchId) : null;

  // With no search chosen the page is a work queue rather than an empty frame:
  // the best rows across every search, which is the question "who do I message
  // next" actually asks.
  const [rows, stats] = active
    ? await Promise.all([getProspects(active.id), getProspectStats(active.id)])
    : [await getTopProspects(), null];

  return (
    <Shell current="/prospects">
      <div className="mx-auto max-w-content">
        <h1
          className="font-display text-heading-lg text-primary"
          style={{ fontVariationSettings: "'opsz' 24, 'SOFT' 25, 'WONK' 0" }}
        >
          Find prospects
        </h1>
        <p className="mt-2 max-w-prose text-body-sm text-muted">
          Businesses from OpenStreetMap. Sorted by score, which is mostly a measure of how
          reachable they are — hover a score to see what it is made of.
        </p>

        {/* On a phone the form is 22 category chips and a slider — the whole
            first screen, before a single prospect. Searching is occasional;
            working the queue is daily, so the form folds away on small screens
            and stays open on desktop where there is room for both. */}
        <details className="group mt-5 md:hidden">
          <summary className="cursor-pointer rounded-sm border border-rule bg-surface px-4 py-3 text-body-sm text-secondary">
            New search
          </summary>
          <div className="mt-3">
            <ProspectSearchForm
              defaultQuery={active?.query ?? ""}
              defaultCategories={active?.categories ?? undefined}
            />
          </div>
        </details>

        <div className="mt-5 hidden md:block">
          <ProspectSearchForm
            defaultQuery={active?.query ?? ""}
            defaultCategories={active?.categories ?? undefined}
          />
        </div>

        {recent.length > 0 && (
          <nav aria-label="Recent searches" className="mt-5 flex flex-wrap gap-2">
            {recent.map((s) => (
              <a
                key={s.id}
                href={`/prospects?search=${s.id}`}
                aria-current={s.id === active?.id ? "page" : undefined}
                className={`rounded-xs border px-3 py-1 text-body-sm ${
                  s.id === active?.id
                    ? "border-accent bg-accent-tint text-primary"
                    : "border-rule text-secondary hover:bg-hovered"
                }`}
              >
                {s.resolvedName?.split(",")[0] ?? s.query}
                <span className="ml-2 font-mono text-data-sm text-muted">
                  {s.status === "complete" ? "" : s.status}
                </span>
              </a>
            ))}
          </nav>
        )}

        {!active && rows.length > 0 && (
          <p className="mt-7 text-body-sm text-muted">
            Best {rows.length} to message next, across every search. Contacted and declined rows
            are not here — pick a search above to see everything it found.
          </p>
        )}

        {(active || rows.length > 0) && (
          <>
            {active && stats && (
              <div className="mt-7 flex flex-wrap gap-6 font-mono text-data-sm tabular-nums text-muted">
                <span className="text-primary">{stats.total} found</span>
                <span className="text-go">{stats.withPhone} with a phone</span>
                <span>{stats.withEmail} with an email</span>
                <span>{stats.withWebsite} with a website</span>
                <RefreshAllButton searchId={active.id} count={stats.total} />
              </div>
            )}

            {active?.status === "failed" && (
              <p role="alert" className="mt-4 rounded-sm border border-stop bg-stop-tint p-3 text-body-sm">
                {active.error ?? "This search failed."}
              </p>
            )}

            {rows.length === 0 ? (
              <p className="mt-6 rounded-md border border-rule bg-surface p-7 text-body text-muted">
                {active?.status === "queued"
                  ? "Queued. Whole-country searches run in the background — run `pnpm search:run --drain`."
                  : "Nothing found here. Try a wider radius or another category."}
              </p>
            ) : (
              <>
              {/* Cards on a phone. The table is eight columns wide; scrolling it
                  sideways to reach the WhatsApp button is not a way to work. */}
              <ul className="mt-6 flex flex-col gap-3 md:hidden">
                {rows.map((p) => (
                  <li key={p.id} className="rounded-md border border-rule bg-surface p-4">
                    <div className="flex items-baseline gap-3">
                      <span
                        className={`font-mono text-data tabular-nums ${
                          p.tier === "hot" ? "text-go" : p.tier === "warm" ? "text-primary" : "text-muted"
                        }`}
                      >
                        {p.score}
                      </span>
                      <span className="min-w-0 flex-1 text-primary">{p.name}</span>
                    </div>
                    <p className="mt-1 font-mono text-data-sm text-faint">
                      {p.category}
                      {p.city ? ` · ${p.city}` : ""}
                      {p.phoneE164 ? ` · ${p.phoneE164}` : ""}
                    </p>
                    <div className="mt-3">
                      <ProspectContact
                        id={p.id}
                        whatsapp={p.whatsapp}
                        email={p.emailChannel}
                        contacted={p.contacted}
                        declined={p.declined}
                        status={p.status}
                      />
                    </div>
                    <div className="mt-3">
                      <ProspectEnhance id={p.id} name={p.name} />
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-6 hidden overflow-x-auto rounded-md border border-rule bg-surface md:block">
                <table className="w-full min-w-[82rem] text-body-sm">
                  <thead>
                    <tr className="border-b border-rule text-label uppercase text-muted">
                      <th className="px-4 py-3 text-left font-normal">Score</th>
                      <th className="px-4 py-3 text-left font-normal">Business</th>
                      <th className="px-4 py-3 text-left font-normal">City</th>
                      <th className="px-4 py-3 text-left font-normal">Reach</th>
                      <th className="px-4 py-3 text-left font-normal">Phone</th>
                      <th className="px-4 py-3 text-left font-normal">Contact</th>
                      <th className="px-4 py-3 text-left font-normal">Site</th>
                      <th className="px-4 py-3 text-left font-normal">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => (
                      <tr key={p.id} className="border-t border-rule-soft hover:bg-hovered">
                        <td className="px-4 py-3">
                          <span
                            title={p.scoreReasons.map(([k, v]) => `${k} +${v}`).join(", ")}
                            className={`font-mono text-data-sm tabular-nums ${
                              p.tier === "hot"
                                ? "text-go"
                                : p.tier === "warm"
                                  ? "text-primary"
                                  : "text-muted"
                            }`}
                          >
                            {p.score}
                            {p.provisional && (
                              <span title="Their site has not been read yet — this is contacts only" className="ml-1 text-faint">
                                ?
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-primary">{p.name}</span>
                          <span className="ml-2 font-mono text-data-sm text-faint">{p.category}</span>
                        </td>
                        <td className="px-4 py-3 text-muted">{p.city ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className="flex gap-2">
                            <Channel ok={p.whatsappReady} label="WhatsApp" />
                            <Channel ok={!!p.email} label="Email" />
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-data-sm tabular-nums text-secondary">
                          {p.phoneE164 ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <ProspectContact
                            id={p.id}
                            whatsapp={p.whatsapp}
                            email={p.emailChannel}
                            contacted={p.contacted}
                            declined={p.declined}
                            status={p.status}
                          />
                        </td>
                        <td className="px-4 py-3">
                          {p.website ? (
                            <a
                              className="text-accent underline underline-offset-2"
                              href={p.website}
                              target="_blank"
                              rel="noreferrer noopener"
                            >
                              visit
                            </a>
                          ) : (
                            <span className="text-faint">none</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <ProspectRowActions
                            id={p.id}
                            email={p.email}
                            phoneE164={p.phoneE164}
                            overridden={p.overridden}
                          />
                          <div className="mt-2">
                            <ProspectEnhance id={p.id} name={p.name} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </>
        )}

        <p className="mt-6 text-caption text-faint">
          Place data © OpenStreetMap contributors, ODbL.
        </p>
      </div>
    </Shell>
  );
}
