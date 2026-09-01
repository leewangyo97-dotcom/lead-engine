import { createHash } from "node:crypto";
import type { NormalisedLead } from "./types";

/**
 * The dedupe key, and the single biggest cost lever in the system.
 *
 * Computed from company | title | region | summary.slice(0,500) and nothing
 * else. Never feed it a timestamp, a view count, a rank, or a position in a
 * list: an unstable hash silently defeats the dedupe that saves ~85% of the
 * nightly cost, and it fails quietly — you get a working system that costs ten
 * times what it should. Phase 1's exit test checks exactly this.
 */
export function contentHash(lead: NormalisedLead): string {
  const parts = [
    lead.company,
    lead.title,
    lead.region ?? "",
    (lead.summary ?? "").slice(0, 500),
  ].map((p) => p.replace(/\s+/g, " ").trim().toLowerCase());

  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}
