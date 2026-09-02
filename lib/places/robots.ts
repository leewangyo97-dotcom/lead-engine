import { OSM_USER_AGENT } from "./nominatim";

/**
 * robots.txt, fetched once per host and remembered.
 *
 * The rule this enforces is not a legal one — robots.txt has no force in most
 * jurisdictions — but a site owner who wrote `Disallow: /` is a poor person to
 * cold-email about building them a website, so respecting it costs nothing and
 * removes the worst outreach targets before they cost a request.
 */

export interface RobotsRules {
  /** Disallowed path prefixes for our user-agent, longest first. */
  disallow: string[];
  allow: string[];
  crawlDelayMs: number | null;
}

/** Permissive default: a missing or unreachable robots.txt is not a refusal. */
const ALLOW_ALL: RobotsRules = { disallow: [], allow: [], crawlDelayMs: null };

const cache = new Map<string, RobotsRules>();

export function parseRobots(text: string, agent = "*"): RobotsRules {
  const rules: RobotsRules = { disallow: [], allow: [], crawlDelayMs: null };
  const wanted = agent.toLowerCase();

  // A group applies to us if any of its User-agent lines names us or is "*".
  // Specific groups win over the wildcard, which is why they are tracked apart.
  let specific: RobotsRules | null = null;
  let wildcard: RobotsRules | null = null;
  let current: RobotsRules[] = [];
  let inGroup = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;

    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "user-agent") {
      // Consecutive User-agent lines share one group; a directive ends it.
      if (inGroup) current = [];
      inGroup = false;
      const ua = value.toLowerCase();
      if (ua === "*") {
        wildcard ??= { disallow: [], allow: [], crawlDelayMs: null };
        current.push(wildcard);
      } else if (wanted.includes(ua) || ua.includes(wanted)) {
        specific ??= { disallow: [], allow: [], crawlDelayMs: null };
        current.push(specific);
      }
      continue;
    }

    inGroup = true;
    for (const group of current) {
      if (field === "disallow" && value) group.disallow.push(value);
      else if (field === "allow" && value) group.allow.push(value);
      else if (field === "crawl-delay") {
        const seconds = Number(value);
        if (Number.isFinite(seconds)) group.crawlDelayMs = Math.min(seconds * 1000, 10_000);
      }
    }
  }

  const chosen = specific ?? wildcard ?? rules;
  chosen.disallow.sort((a, b) => b.length - a.length);
  chosen.allow.sort((a, b) => b.length - a.length);
  return chosen;
}

/**
 * Longest matching rule wins, and Allow beats Disallow at equal length — the
 * behaviour every major crawler settled on, so a site tuned for Google behaves
 * the same here.
 */
export function isAllowed(rules: RobotsRules, path: string): boolean {
  const allow = rules.allow.find((p) => path.startsWith(p));
  const deny = rules.disallow.find((p) => path.startsWith(p));
  if (!deny) return true;
  if (!allow) return false;
  return allow.length >= deny.length;
}

export async function getRobots(
  origin: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RobotsRules> {
  const cached = cache.get(origin);
  if (cached) return cached;

  let rules = ALLOW_ALL;
  try {
    const res = await fetchImpl(`${origin}/robots.txt`, {
      headers: { "User-Agent": OSM_USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
    // 404 means no rules. 5xx means the server is unwell, not that it refuses;
    // treating either as a block would silently empty the enrichment queue.
    if (res.ok) {
      const text = await res.text();
      // Some hosts answer robots.txt with their HTML 404 page.
      if (!/^\s*</.test(text)) rules = parseRobots(text, "lead-engine");
    }
  } catch {
    rules = ALLOW_ALL;
  }

  cache.set(origin, rules);
  return rules;
}

/** Test seam — the cache is process-wide and would otherwise leak between runs. */
export function clearRobotsCache(): void {
  cache.clear();
}
