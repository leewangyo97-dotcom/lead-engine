import { resolveMx } from "node:dns/promises";
import { OSM_USER_AGENT } from "../places/nominatim";
import { getRobots, isAllowed } from "../places/robots";
import type { Fetched, ProviderContext } from "./providers/types";

/**
 * The network side of a provider run: polite fetching and the MX check.
 *
 * The same manners the business crawler keeps (lib/places/enrich.ts): the
 * project's own User-Agent, robots.txt honoured before any page is read, one
 * request a second per host, or the host's own Crawl-delay if longer, and no
 * page read twice in one run. APIs (SEC, GitHub) pass `robots: false`. They
 * are not crawled pages, and they set their own limits in their terms, which
 * the providers keep.
 */
const HOST_DELAY_MS = 1000;
const TIMEOUT_MS = 10_000;
const MAX_CHARS = 600_000;

export function createContext(env: Record<string, string | undefined> = process.env): ProviderContext {
  const cache = new Map<string, Fetched | null>();
  const nextAt = new Map<string, number>();
  const mx = new Map<string, boolean>();

  async function politely(host: string, delayMs: number) {
    const wait = (nextAt.get(host) ?? 0) - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    nextAt.set(host, Date.now() + delayMs);
  }

  return {
    env,
    now: () => new Date(),

    async fetchText(url, init = {}) {
      if (cache.has(url)) return cache.get(url)!;
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return null;
      }
      let delay = HOST_DELAY_MS;
      if (init.robots !== false) {
        const rules = await getRobots(parsed.origin);
        if (!isAllowed(rules, parsed.pathname)) {
          cache.set(url, null);
          return null;
        }
        delay = Math.max(delay, rules.crawlDelayMs ?? 0);
      }
      await politely(parsed.host, delay);
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": OSM_USER_AGENT, ...init.headers },
          redirect: "follow",
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const result = res.ok
          ? { url: res.url || url, status: res.status, text: (await res.text()).slice(0, MAX_CHARS) }
          : null;
        cache.set(url, result);
        return result;
      } catch {
        cache.set(url, null);
        return null;
      }
    },

    async hasMx(domain) {
      const key = domain.toLowerCase();
      if (mx.has(key)) return mx.get(key)!;
      let found = false;
      try {
        found = (await resolveMx(key)).length > 0;
      } catch {
        found = false;
      }
      mx.set(key, found);
      return found;
    },
  };
}
