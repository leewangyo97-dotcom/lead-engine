/**
 * A serial rate limiter: one call at a time, never faster than `minIntervalMs`.
 *
 * Nominatim's usage policy is an absolute maximum of one request per second, and
 * exceeding it gets an IP blocked rather than throttled. A per-call `sleep` is
 * not enough — two callers would each sleep and then fire together — so this
 * chains every call through a single promise.
 */
export class RateLimiter {
  private queue: Promise<unknown> = Promise.resolve();
  // Not 0: with a real clock that is 1970, but the tests use an injected clock
  // starting at 0, where it would delay the very first call by a full interval
  // for no reason. -Infinity means "nothing has run yet" under either clock.
  private lastStart = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly minIntervalMs: number,
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((r) => setTimeout(r, ms)),
    private readonly now: () => number = () => Date.now(),
  ) {}

  run<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.queue.then(async () => {
      const wait = this.lastStart + this.minIntervalMs - this.now();
      if (wait > 0) await this.sleep(wait);
      this.lastStart = this.now();
      return fn();
    });

    // The chain must not break when one call rejects, or every later call is
    // rejected too. Callers still see their own error through `result`.
    this.queue = result.catch(() => undefined);
    return result;
  }
}

/** Shared across the process: the limit is per IP, not per call site. */
export const nominatimLimiter = new RateLimiter(1100);
