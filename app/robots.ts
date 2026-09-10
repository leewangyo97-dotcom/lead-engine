import type { MetadataRoute } from "next";

/**
 * Nothing here is for a search engine.
 *
 * The deployment is public — every page answers 200 to anyone — and `/prospects`
 * renders the name, phone number and email address of every business in the
 * queue. Twenty-five contacts on the first page, and 7,643 reachable rows behind
 * the paging. That is other people's contact details, collected from
 * OpenStreetMap for one person to write to, not a directory to publish.
 *
 * This does not make the site private; a crawler that ignores the file, or
 * anyone with the URL, still sees everything. It stops the ordinary case, which
 * is a search engine turning a personal tool into an indexed contact database.
 * The access question is separate and is recorded in docs/08-RUNBOOK.md.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
