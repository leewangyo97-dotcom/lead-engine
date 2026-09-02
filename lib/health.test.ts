import { describe, expect, it } from "vitest";
import { pipelineFaults, pipelineWarnings, STALE_HOURS, type SourceHealth, expectedLastRun } from "./health";

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
    expect(faults[0]).toMatch(/missed the run/);
    expect(faults[0]).toContain("b");
  });

  it("tolerates a gap that has not yet reached a scheduled run", () => {
    // NOW is Tuesday noon; the last run was due Monday 20:00 and happened.
    expect(pipelineFaults({ latestRawCount: 200, sources: [ok("a", 16)], now: NOW })).toEqual([]);
  });

  it("reports a source that has never run", () => {
    const faults = pipelineFaults({
      latestRawCount: 200,
      sources: [{ id: "new", lastRunAt: null, lastOk: true }],
      now: NOW,
    });
    expect(faults[0]).toMatch(/missed the run/);
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

describe("expectedLastRun", () => {
  const at = (iso: string) => new Date(iso);

  it("is today's slot once it has passed", () => {
    // Wednesday 21:00 UTC — the 20:00 run was due an hour ago.
    expect(expectedLastRun(at("2026-09-02T21:00:00Z"))?.toISOString()).toBe(
      "2026-09-02T20:00:00.000Z",
    );
  });

  it("is yesterday's slot before today's has come round", () => {
    expect(expectedLastRun(at("2026-09-02T09:00:00Z"))?.toISOString()).toBe(
      "2026-09-01T20:00:00.000Z",
    );
  });

  it("steps back over the weekend rather than expecting a run", () => {
    // Saturday, Sunday, and Monday morning all point at Friday evening.
    for (const iso of ["2026-09-05T12:00:00Z", "2026-09-06T23:00:00Z", "2026-09-07T09:00:00Z"]) {
      expect(expectedLastRun(at(iso))?.toISOString()).toBe("2026-09-04T20:00:00.000Z");
    }
  });
});

describe("pipelineFaults and the schedule", () => {
  const source = (lastRunAt: Date) => ({
    id: "hn-whoishiring",
    lastOk: true,
    lastRunAt,
    lastRawCount: 400,
  });

  it("does not cry stale over a weekend", () => {
    // Friday's run, checked on Sunday: seventy-two hours of silence, all of it
    // legitimate. The old flat 36-hour rule failed here every week.
    const faults = pipelineFaults({
      latestRawCount: 400,
      sources: [source(new Date("2026-09-04T20:05:00Z"))],
      now: new Date("2026-09-06T18:00:00Z"),
    });
    expect(faults).toEqual([]);
  });

  it("reports a night the scheduler skipped", () => {
    // What actually happened: a run on Tuesday, none on Wednesday.
    const faults = pipelineFaults({
      latestRawCount: 400,
      sources: [source(new Date("2026-09-01T20:05:00Z"))],
      now: new Date("2026-09-03T09:00:00Z"),
    });
    expect(faults.some((f) => /missed the run/.test(f))).toBe(true);
  });

  it("allows a late run within the grace period", () => {
    // GitHub delays these under load; an hour late is not a fault.
    const faults = pipelineFaults({
      latestRawCount: 400,
      sources: [source(new Date("2026-09-01T20:05:00Z"))],
      now: new Date("2026-09-02T23:00:00Z"),
    });
    expect(faults).toEqual([]);
  });
});
