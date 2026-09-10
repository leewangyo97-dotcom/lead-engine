/**
 * Paging for a search's own results.
 *
 * A country-wide search found 13,134 businesses and the page showed the first
 * 200. The other 12,934 were in the table, counted in the header, and
 * unreachable — there was no next link, so "what did this search find" could
 * only ever answer for the first page of it.
 *
 * Offset paging rather than a cursor: the rows are ordered by score, a person
 * reads a few pages at most, and `search_id` is indexed. A cursor would be the
 * right answer for an API and is a worse one for a link somebody types.
 */
export const PAGE_SIZE = 200;

export interface Page {
  /** 1-based, clamped into range. */
  number: number;
  size: number;
  offset: number;
  total: number;
  pages: number;
  /** 1-based inclusive bounds of what this page shows, for a label. */
  from: number;
  to: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export function pageOf(total: number, requested: number | undefined, size = PAGE_SIZE): Page {
  const pages = Math.max(1, Math.ceil(total / size));

  // A page beyond the end lands on the last one rather than showing nothing: a
  // stale bookmark after rows were pruned should still show results.
  const number = Math.min(Math.max(1, Math.floor(requested ?? 1) || 1), pages);
  const offset = (number - 1) * size;

  return {
    number,
    size,
    offset,
    total,
    pages,
    from: total === 0 ? 0 : offset + 1,
    to: Math.min(offset + size, total),
    hasPrevious: number > 1,
    hasNext: number < pages,
  };
}

/** Parses `?page=`, where anything unreadable means the first page. */
export function parsePage(value: string | string[] | undefined): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : undefined;
}

/** A label that reads the same whether there is one row or thirteen thousand. */
export function pageLabel(page: Page): string {
  if (page.total === 0) return "no rows";
  if (page.pages === 1) return `${page.total} row${page.total === 1 ? "" : "s"}`;
  return `${page.from}–${page.to} of ${page.total}`;
}
