import { Shell } from "@/app/components/shell";
import { DiscoverPanel } from "@/app/components/people-discover";
import { PeopleTable, type PersonView, type SortKey } from "@/app/components/people-table";
import { dispatchConfigured } from "@/lib/github/dispatch";
import { formatDay, formatWhen } from "@/lib/people/format";
import { recentJobs } from "@/lib/people/jobs";
import {
  listPeople,
  PAGE_SIZE,
  parseFilter,
  peopleFacets,
  SIZE_BANDS,
  STATUSES,
  STATUS_LABEL,
  type Facet,
} from "@/lib/people/queries";
import { categoryLabel } from "@/lib/places/queue-filter";
import { getProspectsByIds } from "@/lib/places/prospect-queries";
import { demoIneligible } from "@/lib/demo/render";
import { SENIORITY_LABEL } from "@/lib/people/seniority";

export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;

const SENIORITY_FILTERS = ["founder_owner", "c_level", "vp", "director"] as const;
const INPUT =
  "mt-2 w-full rounded-sm border border-rule bg-sunk px-3 py-2 text-body-sm text-primary placeholder:text-faint";

const REGION = new Intl.DisplayNames(["en"], { type: "region" });
/** "AU" reads "Australia"; anything Intl does not know stays as it came. */
const countryName = (code: string) => {
  try {
    return REGION.of(code) ?? code;
  } catch {
    return code;
  }
};

/**
 * Country and Category, as chips with how many people each holds, like the
 * ones on /prospects. Clicking the active chip clears it.
 */
function FilterChips({
  label,
  keyName,
  active,
  options,
  params,
  format,
}: {
  label: string;
  keyName: "country" | "category";
  active?: string;
  options: Facet[];
  params: Params;
  format: (value: string) => string;
}) {
  if (options.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-baseline gap-2">
      <span className="mr-1 text-label text-secondary">{label}</span>
      {options.map((o) => {
        const on = active === o.name;
        return (
          <a
            key={o.name}
            href={`/people${query(params, { [keyName]: on ? undefined : o.name, page: undefined })}`}
            aria-current={on ? "true" : undefined}
            className={`rounded-xs border px-3 py-1 text-body-sm ${
              on ? "border-accent bg-accent-tint text-primary" : "border-rule text-secondary hover:bg-hovered"
            }`}
          >
            {format(o.name)}
            <span className="ml-2 font-mono text-data-sm text-muted">{o.count}</span>
          </a>
        );
      })}
    </div>
  );
}

/** The page's query string with some keys changed; undefined drops a key. */
function query(params: Params, changes: Record<string, string | undefined> = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k in changes) continue;
    for (const one of ([] as string[]).concat(v ?? [])) if (one) q.append(k, one);
  }
  for (const [k, v] of Object.entries(changes)) if (v !== undefined) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export default async function PeoplePage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const filter = parseFilter(params);
  const [{ rows, total }, jobs, facets] = await Promise.all([listPeople(filter), recentJobs(5), peopleFacets()]);
  // Enhance and Make demo act on the business, so it is read the way /prospects
  // reads it: the published demo link and whether a demo can be made match.
  const businessIds = [...new Set(rows.map((r) => r.prospectId).filter((id): id is string => !!id))];
  const businesses = new Map((await getProspectsByIds(businessIds)).map((b) => [b.id, b]));
  // What "From local businesses" is narrowed to: the chips chosen here.
  const scopeLabel = [filter.country && countryName(filter.country), filter.category && categoryLabel(filter.category)]
    .filter(Boolean)
    .join(" · ");

  const page = filter.page ?? 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // From the parsed filter, not the raw keys: an applied form sends every field, empty or not.
  const filtered = !!(
    filter.q || filter.seniority || filter.industry || filter.country || filter.category || filter.size ||
    filter.location || filter.verified ||
    filter.scoreMin !== undefined || filter.scoreMax !== undefined || filter.status
  );

  const sorts = Object.fromEntries(
    (["score", "name", "company", "added"] as SortKey[]).map((key) => {
      const on = filter.sort === key;
      // Names read A to Z first; numbers and dates best and newest first.
      const first = key === "name" || key === "company" ? "asc" : "desc";
      const dir = on ? (filter.dir === "asc" ? "desc" : "asc") : first;
      return [
        key,
        { href: `/people${query(params, { sort: key, dir, page: undefined })}`, mark: on ? (filter.dir === "asc" ? " ↑" : " ↓") : "" },
      ];
    }),
  ) as Record<SortKey, { href: string; mark: string }>;

  const view: PersonView[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    title: r.title,
    seniority: r.seniority,
    email: r.email,
    emailStatus: r.emailStatus,
    phone: r.phone,
    score: r.score,
    status: r.status,
    added: formatDay(r.createdAt),
    company: r.company,
    domain: r.domain,
    industry: r.industry,
    sizeBand: r.sizeBand,
    location: r.location,
    sources: r.sources ?? [],
    blocked: !!r.blocked,
    prospectId: r.prospectId,
    business: (() => {
      const b = r.prospectId ? businesses.get(r.prospectId) : undefined;
      return b
        ? {
            name: b.name,
            demoUrl: b.demoUrl,
            demoEligible: b.demoEligible,
            demoBlocked: !b.demoEligible && !b.demoUrl ? demoIneligible(b) : null,
          }
        : null;
    })(),
  }));

  return (
    <Shell current="/people">
      <div className="mx-auto max-w-content">
        <h1 className="font-display text-heading-lg text-primary">Decision-makers</h1>
        <p className="mt-2 max-w-prose text-body-sm text-muted">
          Founders, owners and directors at the companies you are looking at, each with the public
          page they came from. Business contact details only. A guessed address is for research:
          it is never copied, exported or sent.
        </p>

        <DiscoverPanel
          oneClick={dispatchConfigured()}
          scope={{ country: filter.country, category: filter.category, label: scopeLabel || undefined }}
          jobs={jobs.map((j) => ({
            id: j.id,
            status: j.status,
            progress: j.progress,
            total: j.total,
            message: j.message,
            created: formatWhen(j.createdAt),
          }))}
        />

        <div className="mt-6">
          <FilterChips
            label="Country"
            keyName="country"
            active={filter.country}
            options={facets.countries}
            params={params}
            format={countryName}
          />
          <FilterChips
            label="Category"
            keyName="category"
            active={filter.category}
            options={facets.categories}
            params={params}
            format={categoryLabel}
          />
        </div>

        <form method="get" action="/people" className="mt-6 rounded-md border border-rule bg-surface p-5">
          {/* Applying the form keeps the chips that are on. */}
          {filter.country && <input type="hidden" name="country" value={filter.country} />}
          {filter.category && <input type="hidden" name="category" value={filter.category} />}
          <div className="grid gap-4 md:grid-cols-4">
            <label className="block md:col-span-2">
              <span className="text-label text-secondary">Search</span>
              <input name="q" defaultValue={filter.q ?? ""} placeholder="Name, title, company or email" className={INPUT} />
            </label>
            <label className="block">
              <span className="text-label text-secondary">Location</span>
              <input name="location" defaultValue={filter.location ?? ""} placeholder="City, state or country" className={INPUT} />
            </label>
            <label className="block">
              <span className="text-label text-secondary">Company size</span>
              <select name="size" defaultValue={filter.size ?? ""} className={INPUT}>
                <option value="">Any size</option>
                {SIZE_BANDS.map((s) => (
                  <option key={s} value={s}>
                    {s} people
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-label text-secondary">Status</span>
              <select name="status" defaultValue={filter.status ?? ""} className={INPUT}>
                <option value="">Any status</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <div className="md:col-span-2">
              <span className="text-label text-secondary">Score</span>
              <div className="flex items-center gap-3">
                <input
                  name="scoreMin"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={filter.scoreMin ?? ""}
                  placeholder="0"
                  aria-label="Lowest score"
                  className={INPUT}
                />
                <span className="mt-2 text-body-sm text-muted">to</span>
                <input
                  name="scoreMax"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={filter.scoreMax ?? ""}
                  placeholder="100"
                  aria-label="Highest score"
                  className={INPUT}
                />
              </div>
            </div>
          </div>

          <fieldset className="mt-4 flex flex-wrap items-center gap-5">
            <legend className="sr-only">Seniority</legend>
            {SENIORITY_FILTERS.map((s) => (
              <label key={s} className="inline-flex items-center gap-2 text-body-sm text-secondary">
                <input type="checkbox" name="seniority" value={s} defaultChecked={filter.seniority?.includes(s)} />
                {SENIORITY_LABEL[s]}
              </label>
            ))}
            <label className="inline-flex items-center gap-2 text-body-sm text-secondary">
              <input type="checkbox" name="verified" value="1" defaultChecked={filter.verified} />
              Has a verified email
            </label>
          </fieldset>

          {filter.sort !== "score" && <input type="hidden" name="sort" value={filter.sort} />}
          {filter.dir === "asc" && <input type="hidden" name="dir" value="asc" />}
          <div className="mt-5 flex items-center gap-4">
            <button type="submit" className="rounded-xs bg-accent px-3 py-1 text-body-sm text-on-accent">
              Apply
            </button>
            {filtered && (
              <a href="/people" className="text-body-sm text-accent underline underline-offset-2">
                Clear filters
              </a>
            )}
          </div>
        </form>

        <div className="mt-7 flex flex-wrap items-baseline gap-6 font-mono text-data-sm tabular-nums text-muted">
          <span className="text-primary">
            {total} {total === 1 ? "person" : "people"}
          </span>
          {pages > 1 && (
            <span>
              page {page} of {pages}
            </span>
          )}
          {total > 0 && (
            <a
              href={`/api/people/export${query(params, { page: undefined })}`}
              className="text-accent underline underline-offset-2"
              title="The do-not-contact list is checked first; guessed addresses are left out"
            >
              Export CSV
            </a>
          )}
        </div>

        {total === 0 ? (
          <p className="mt-6 rounded-md border border-rule bg-surface p-5 text-body-sm text-secondary">
            {filtered
              ? "No one matches these filters."
              : "Nobody yet. Start discovery above: it reads company websites for the people who decide."}
          </p>
        ) : (
          <PeopleTable rows={view} sorts={sorts} seniorityLabel={SENIORITY_LABEL} />
        )}

        {pages > 1 && (
          <nav aria-label="Pages" className="mt-5 flex items-center justify-between gap-3">
            {page > 1 ? (
              <a
                href={`/people${query(params, { page: String(page - 1) })}`}
                className="rounded-xs border border-rule px-3 py-1 text-body-sm text-secondary hover:bg-hovered"
              >
                ← Previous
              </a>
            ) : (
              <span />
            )}
            {page < pages && (
              <a
                href={`/people${query(params, { page: String(page + 1) })}`}
                className="rounded-xs border border-rule px-3 py-1 text-body-sm text-secondary hover:bg-hovered"
              >
                Next →
              </a>
            )}
          </nav>
        )}
      </div>
    </Shell>
  );
}
