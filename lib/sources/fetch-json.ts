/**
 * The one place any adapter talks to the network.
 *
 * Two problems this exists to stop:
 *
 * A hung request. `fetch` has no default timeout, so a source that accepts a
 * connection and then stalls holds the nightly job until GitHub kills it at 15
 * minutes — and every later adapter is skipped along with it.
 *
 * A transient blip turning the run red. `harvest.ts` marks a source failed and
 * `report-run.ts` exits non-zero, which is right for a broken adapter and wrong
 * for one 502. A run that goes red for reasons nobody caused stops being read,
 * and then a real failure goes unnoticed too.
 */
export const DEFAULT_TIMEOUT_MS = 15_000;
export const MAX_ATTEMPTS = 3;

/** Retry only what a retry can fix: 5xx, 429, and network-level failures. */
export function isRetryable(status: number): boolean {
  return status === 429 || status === 408 || status >= 500;
}

const backoffMs = (attempt: number) => 500 * 2 ** (attempt - 1);

export interface FetchJsonOptions {
  headers?: Record<string, string>;
  /** Overpass wants a POSTed query body; everything else here is a GET. */
  method?: "GET" | "POST";
  body?: string;
  timeoutMs?: number;
  attempts?: number;
  /** Injected in tests so they do not spend real seconds sleeping. */
  sleep?: (ms: number) => Promise<void>;
  fetchImpl?: typeof fetch;
}

export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const {
    headers,
    method = "GET",
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    attempts = MAX_ATTEMPTS,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    fetchImpl = fetch,
  } = options;

  let lastError = "";

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetchImpl(url, {
        method,
        body,
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.ok) return (await res.json()) as T;

      // A 404 or 403 will be a 404 or 403 on the next attempt too. Failing now
      // reports the real problem instead of three copies of it.
      if (!isRetryable(res.status)) {
        throw new Error(`${url} returned ${res.status}`);
      }
      lastError = `${res.status}`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // A non-retryable status was thrown above; let it out rather than
      // retrying it under the guise of a network error.
      if (message.includes("returned")) throw err;
      lastError = message;
    }

    if (attempt < attempts) await sleep(backoffMs(attempt));
  }

  throw new Error(`${url} failed after ${attempts} attempts: ${lastError}`);
}

/** Same policy, for a source that returns text rather than JSON. */
export async function fetchText(url: string, options: FetchJsonOptions = {}): Promise<string> {
  const { headers, timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch } = options;
  const res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.text();
}
