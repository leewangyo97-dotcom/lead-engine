import { describe, expect, it } from "vitest";
import { REOPEN_WINDOW_MS, withinReopenWindow } from "./outreach-log";
import { LADDER_DAYS } from "../followups";

const now = new Date("2026-09-10T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

describe("withinReopenWindow", () => {
  it("treats a click seconds after the last one as reopening", () => {
    // What actually happened: three clicks on one clinic wrote steps 0, 1 and 2,
    // spending the whole ladder on a single message.
    expect(withinReopenWindow(ago(9_000), now)).toBe(true);
  });

  it("treats a click hours later the same way", () => {
    // Long enough to cover a mail client that failed to open the first time.
    expect(withinReopenWindow(ago(6 * 3_600_000), now)).toBe(true);
  });

  it("lets the next day be a new rung", () => {
    expect(withinReopenWindow(ago(REOPEN_WINDOW_MS + 1_000), now)).toBe(false);
  });

  it("treats an unsent row as reopenable", () => {
    // A draft nobody sent is not a touch, so clicking it is still the first.
    expect(withinReopenWindow(null, now)).toBe(true);
  });

  it("closes well before the first rung falls due", () => {
    // Otherwise a legitimate day-4 follow-up would be swallowed as a reopen.
    const firstRungMs = LADDER_DAYS[0] * 86_400_000;
    expect(REOPEN_WINDOW_MS).toBeLessThan(firstRungMs);
  });
});
