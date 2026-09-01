import { describe, expect, it } from "vitest";
import { pipelineFaults, pipelineWarnings, STALE_HOURS, type SourceHealth } from "./health";

const NOW = new Date("2026-09-01T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const ok = (id: string, h = 1): SourceHealth => ({ id, lastRunAt: hoursAgo(h), lastOk: true });

describe("pipeline health", () => {
  it("is silent when everything is fine", () => {
    expect(pipelineFaults({ latestRawCount: 200, sources: [ok("a"), ok("b")], now: NOW })).toEqual([]);
  });

  it("does not mistake zero NEW rows for a fault", () => {
    // The content hash means most nights insert nothing. That is the design
    // working, and treating it as a fault would make the alert meaningless.
    expect(pipelineFaults({ latestRawCount: 264, sources: [ok("a")], now: NOW })).toEqual([]);
  });

  it("catches a source that silently returns nothing", () => {
    const faults = pipelineFaults({ latestRawCount: 0, sources: [ok("a")], now: NOW });
    expect(faults).toHaveLength(1);
    expect(faults[0]).toMatch(/starved/);
  });

  it("catches a scheduler that has stopped", () => {
    const faults = pipelineFaults({
      latestRawCount: 200,
      sources: [ok("a"), { id: "b", lastRunAt: hoursAgo(STALE_HOURS + 1), lastOk: true }],
      now: NOW,
    });
    expect(faults[0]).toMatch(/have not run/);
    expect(faults[0]).toContain("b");
  });

  it("tolerates a normal weekend gap", () => {
    // The cron is Mon-Fri, so a Monday run is more than 24h after Friday's.
    expect(pipelineFaults({ latestRawCount: 200, sources: [ok("a", 30)], now: NOW })).toEqual([]);
  });

  it("reports a source that has never run", () => {
    const faults = pipelineFaults({
      latestRawCount: 200,
      sources: [{ id: "new", lastRunAt: null, lastOk: true }],
      now: NOW,
    });
    expect(faults[0]).toMatch(/have not run/);
  });

  it("still reports an outright failure, and lists every fault", () => {
    const faults = pipelineFaults({
      latestRawCount: 0,
      sources: [{ id: "a", lastRunAt: null, lastOk: false, lastError: "404" }],
      now: NOW,
    });
    expect(faults).toHaveLength(3);
  });

  it("says nothing about raw count before any run is recorded", () => {
    // A fresh deploy has no run_metrics row. That is not a starved pipeline.
    expect(pipelineFaults({ latestRawCount: null, sources: [ok("a")], now: NOW })).toEqual([]);
  });
});

describe("a single source going silent", () => {
  const NOW2 = new Date("2026-09-01T12:00:00Z");
  const recent = new Date(NOW2.getTime() - 3_600_000);

  it("warns rather than fails, since an empty feed is a real outcome", () => {
    const state = {
      latestRawCount: 190,
      sources: [
        { id: "hn", lastRunAt: recent, lastOk: true, lastRawCount: 173 },
        { id: "remoteok", lastRunAt: recent, lastOk: true, lastRawCount: 0 },
      ],
      now: NOW2,
    };
    // RemoteOK yields 3-4 engineering roles from 100 items; zero is a slow day,
    // not a dead adapter, and a red run for it would train the alert away.
    expect(pipelineFaults(state)).toEqual([]);
    expect(pipelineWarnings(state)[0]).toContain("remoteok");
  });

  it("flags an adapter returning nothing while others work", () => {
    // A site redesign kills one adapter; the others carry on and the total
    // stays healthy, so nothing else would notice.
    const warnings = pipelineWarnings({
      sources: [
        { id: "hn", lastRunAt: recent, lastOk: true, lastRawCount: 173 },
        { id: "remoteok", lastRunAt: recent, lastOk: true, lastRawCount: 0 },
      ],
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("remoteok");
  });

  it("says nothing when every source is silent — that is the starvation fault", () => {
    // That is the outage case, already covered by the starvation check.
    const faults = pipelineFaults({
      latestRawCount: 0,
      sources: [
        { id: "hn", lastRunAt: recent, lastOk: true, lastRawCount: 0 },
        { id: "remoteok", lastRunAt: recent, lastOk: true, lastRawCount: 0 },
      ],
      now: NOW2,
    });
    expect(faults).toHaveLength(1);
    expect(faults[0]).toMatch(/starved/);
  });

  it("accepts a source that is simply low-volume", () => {
    expect(
      pipelineWarnings({
        sources: [
          { id: "hn", lastRunAt: recent, lastOk: true, lastRawCount: 173 },
          { id: "remoteok", lastRunAt: recent, lastOk: true, lastRawCount: 4 },
        ],
      }),
    ).toEqual([]);
  });

  it("says nothing when counts have never been recorded", () => {
    // Sources that ran before this column existed report null, not zero.
    expect(
      pipelineWarnings({
        sources: [{ id: "hn", lastRunAt: recent, lastOk: true, lastRawCount: null }],
      }),
    ).toEqual([]);
  });
});
