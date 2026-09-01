import { describe, expect, it } from "vitest";
import { fetchJson, isRetryable } from "./fetch-json";

const noSleep = async () => {};

function stubFetch(responses: (number | "network-error")[]) {
  let calls = 0;
  const impl = (async () => {
    const next = responses[Math.min(calls, responses.length - 1)];
    calls += 1;
    if (next === "network-error") throw new TypeError("fetch failed");
    return {
      ok: next >= 200 && next < 300,
      status: next,
      json: async () => ({ ok: true, call: calls }),
    } as Response;
  }) as unknown as typeof fetch;
  return { impl, calls: () => calls };
}

describe("fetchJson", () => {
  it("returns the body on success, without retrying", async () => {
    const f = stubFetch([200]);
    await expect(fetchJson("https://x", { fetchImpl: f.impl, sleep: noSleep })).resolves.toEqual({
      ok: true,
      call: 1,
    });
    expect(f.calls()).toBe(1);
  });

  it("retries a 5xx and succeeds", async () => {
    // The case this exists for: one blip must not mark a source failed for the
    // night and turn the whole run red.
    const f = stubFetch([503, 200]);
    await expect(fetchJson("https://x", { fetchImpl: f.impl, sleep: noSleep })).resolves.toBeTruthy();
    expect(f.calls()).toBe(2);
  });

  it("retries a network error", async () => {
    const f = stubFetch(["network-error", 200]);
    await expect(fetchJson("https://x", { fetchImpl: f.impl, sleep: noSleep })).resolves.toBeTruthy();
    expect(f.calls()).toBe(2);
  });

  it("does not retry a 404 — it will be a 404 next time too", async () => {
    const f = stubFetch([404]);
    await expect(fetchJson("https://x", { fetchImpl: f.impl, sleep: noSleep })).rejects.toThrow(/404/);
    expect(f.calls()).toBe(1);
  });

  it("gives up after the attempt limit and names the last failure", async () => {
    const f = stubFetch([500]);
    await expect(
      fetchJson("https://x", { fetchImpl: f.impl, sleep: noSleep, attempts: 3 }),
    ).rejects.toThrow(/failed after 3 attempts/);
    expect(f.calls()).toBe(3);
  });

  it("treats rate limiting and timeouts as retryable, and client errors as not", () => {
    expect(isRetryable(429)).toBe(true);
    expect(isRetryable(408)).toBe(true);
    expect(isRetryable(502)).toBe(true);
    expect(isRetryable(400)).toBe(false);
    expect(isRetryable(403)).toBe(false);
  });

  it("aborts rather than hanging forever", async () => {
    // fetch has no default timeout, so a stalled source would hold the nightly
    // job until GitHub kills it, taking every later adapter with it.
    const hang = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      })) as unknown as typeof fetch;

    await expect(
      fetchJson("https://x", { fetchImpl: hang, timeoutMs: 10, attempts: 1, sleep: noSleep }),
    ).rejects.toThrow(/failed after 1 attempt/);
  });
});
