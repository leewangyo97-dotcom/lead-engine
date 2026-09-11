import { describe as suite, expect, it } from "vitest";
import {
  describe as summarise,
  HEAVY_PAGE_BYTES,
  mainDocumentStatus,
  needsMeasuring,
  measuredOn,
  readLighthouse,
  storedLighthouse,
  STABLE_AUDITS,
  VOLATILE_AUDITS,
  type ReportLike,
} from "./lighthouse-signals";

/** A report shaped like the real thing, with only the audits under test filled in. */
function report(over: Partial<ReportLike> = {}, audits: ReportLike["audits"] = {}): ReportLike {
  return {
    requestedUrl: "https://theroofingguy.co/",
    finalDisplayedUrl: "https://theroofingguy.co/",
    audits: {
      "network-requests": {
        score: null,
        details: { items: [{ url: "https://theroofingguy.co/", statusCode: 200 }] },
      },
      "total-byte-weight": {
        score: 0.1,
        numericValue: 10_726_400,
        numericUnit: "byte",
        displayValue: "Total size was 10,475 KiB",
      },
      ...audits,
    },
    ...over,
  };
}

suite("the allow-list is the guarantee", () => {
  it("reads no audit that was measured to move between runs", () => {
    // Measured, not assumed: two runs of theroofingguy.co disagreed on every one
    // of these. A score built on them cannot be said to a stranger.
    for (const volatile of VOLATILE_AUDITS) {
      expect(STABLE_AUDITS).not.toContain(volatile);
    }
  });

  it("ignores a timing audit even when the report carries one", () => {
    const withTiming = report({}, {
      "largest-contentful-paint": { score: 0.06, numericValue: 6000, displayValue: "6.0 s" },
      "total-blocking-time": { score: 0.7, numericValue: 350, displayValue: "350 ms" },
    });
    const read = readLighthouse(withTiming);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(JSON.stringify(read.signals)).not.toMatch(/6000|350|paint|blocking/i);
  });
});

suite("readLighthouse", () => {
  it("keeps the page weight and Lighthouse's own wording for it", () => {
    const read = readLighthouse(report());
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.signals.totalBytes).toBe(10_726_400);
    // Stored as printed so the claim can be checked against the report itself.
    expect(read.signals.totalBytesLabel).toBe("Total size was 10,475 KiB");
  });

  it("counts the structural failures rather than scoring them", () => {
    const read = readLighthouse(
      report({}, {
        "unsized-images": { score: 0, details: { items: [{}, {}, {}] } },
        "color-contrast": { score: 0, details: { items: [{}, {}] } },
        "link-name": { score: 0, details: { items: [{}] } },
        "unminified-css": { score: 0.5, details: { items: [{}], overallSavingsBytes: 3121 } },
        "unused-javascript": { score: 0.5, details: { items: [{}], overallSavingsBytes: 24762 } },
      }),
    );
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.signals.unsizedImages).toBe(3);
    expect(read.signals.contrastFailures).toBe(2);
    expect(read.signals.namelessLinks).toBe(1);
    expect(read.signals.unminifiedCssBytes).toBe(3121);
    expect(read.signals.unusedJsBytes).toBe(24762);
  });

  it("takes byte savings from details, never from numericValue", () => {
    // The real shape, copied from a run against theroofingguy.co: numericValue
    // is 150 with numericUnit "millisecond" while the page really has 24,762
    // saveable bytes. Reading numericValue stores a modelled timing estimate in
    // a field named for bytes — a volatile number wearing a stable name.
    const read = readLighthouse(
      report({}, {
        "unused-javascript": {
          score: 0.5,
          numericValue: 150,
          numericUnit: "millisecond",
          displayValue: "Est savings of 24 KiB",
          details: { items: [{}], overallSavingsBytes: 24762 },
        },
      }),
    );
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.signals.unusedJsBytes).toBe(24762);
    expect(read.signals.unusedJsBytes).not.toBe(150);
  });

  it("refuses a page weight that is not counted in bytes", () => {
    const read = readLighthouse(
      report({}, {
        "total-byte-weight": { score: 0.1, numericValue: 1200, numericUnit: "millisecond" },
      }),
    );
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.reason).toContain("millisecond");
  });

  it("is zero, not undefined, for an audit the report does not carry", () => {
    const read = readLighthouse(report());
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.signals.unsizedImages).toBe(0);
    expect(read.signals.unusedJsBytes).toBe(0);
  });

  it("stamps when it was measured, because the site can change tomorrow", () => {
    const read = readLighthouse(report(), new Date("2026-09-11T04:00:00.000Z"));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.signals.measuredAt).toBe("2026-09-11T04:00:00.000Z");
  });
});

suite("a refused request is not a fast website", () => {
  it("refuses a report whose page answered 403", () => {
    // The CDW Studios failure, in Lighthouse's shape: a 52-byte forbidden body
    // has no unsized images, no contrast failures and almost no bytes, so it
    // measures as an excellent site. Writing that down is the false record.
    const read = readLighthouse(
      report({}, {
        "network-requests": {
          score: null,
          details: { items: [{ url: "https://theroofingguy.co/", statusCode: 403 }] },
        },
      }),
    );
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.reason).toContain("403");
  });

  it("refuses a report Lighthouse itself could not complete", () => {
    const read = readLighthouse(
      report({ runtimeError: { code: "NO_FCP", message: "The page did not paint" } }),
    );
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.reason).toContain("NO_FCP");
  });

  it("refuses a report with no page weight to read", () => {
    const read = readLighthouse(report({}, { "total-byte-weight": undefined }));
    expect(read.ok).toBe(false);
  });

  it("accepts a 200 reached through a redirect", () => {
    // http:// prospects redirect to https, so the first request is the redirect
    // and matching on position alone would read the 301 as the page.
    const read = readLighthouse(
      report({ requestedUrl: "http://malonewheeler.com/", finalDisplayedUrl: "https://www.malonewheeler.com/" }, {
        "network-requests": {
          score: null,
          details: {
            items: [
              { url: "http://malonewheeler.com/", statusCode: 301 },
              { url: "https://www.malonewheeler.com/", statusCode: 200 },
            ],
          },
        },
      }),
    );
    expect(read.ok).toBe(true);
  });
});

suite("storedLighthouse", () => {
  const read = readLighthouse(report());
  if (!read.ok) throw new Error("fixture should read");

  it("round-trips a block written alongside the HTML enricher's own keys", () => {
    const column = { noHttps: false, noViewport: false, hasBookingForm: true, lighthouse: read.signals };
    expect(storedLighthouse(column)?.totalBytes).toBe(10_726_400);
  });

  it("is null when nobody has run the measurement", () => {
    expect(storedLighthouse({ noHttps: false, noViewport: false })).toBeNull();
    expect(storedLighthouse(null)).toBeNull();
    expect(storedLighthouse(undefined)).toBeNull();
  });

  it("is null for a half-written block, rather than reading as present", () => {
    // jsonb is typed Record<string, unknown>, so every reader is guessing. A
    // block missing its fields that still reads as present is how an
    // "undefined KiB" reaches a message.
    expect(storedLighthouse({ lighthouse: { totalBytes: 10 } })).toBeNull();
    expect(storedLighthouse({ lighthouse: { url: "https://x.com/" } })).toBeNull();
    expect(storedLighthouse({ lighthouse: "yes" })).toBeNull();
  });
});

suite("measuredOn", () => {
  it("holds when enrichment rewrote the URL to where the site actually is", () => {
    // The common case: OpenStreetMap has http://, the site redirects to https
    // and www, and enrichment stores the destination. Same page.
    expect(measuredOn({ url: "https://www.malonewheeler.com/" }, "http://malonewheeler.com")).toBe(true);
  });

  it("fails when the record now points somewhere else entirely", () => {
    // A reading kept through a re-enrichment that moved the site is a fact about
    // a server this business no longer uses.
    expect(measuredOn({ url: "https://oldsite.com/" }, "https://newsite.com/")).toBe(false);
  });

  it("fails when the record has no website at all", () => {
    expect(measuredOn({ url: "https://x.com/" }, null)).toBe(false);
  });

  it("fails on a reading with no URL, rather than matching everything", () => {
    expect(measuredOn({ url: "" }, "https://x.com/")).toBe(false);
  });
});

suite("mainDocumentStatus", () => {
  it("is null when the report lists no requests", () => {
    expect(mainDocumentStatus(report({}, { "network-requests": undefined }))).toBeNull();
  });
});

suite("describe", () => {
  it("calls out a page heavy enough to raise with the owner", () => {
    const read = readLighthouse(report());
    if (!read.ok) throw new Error("expected a reading");
    expect(read.signals.totalBytes).toBeGreaterThan(HEAVY_PAGE_BYTES);
    expect(summarise(read.signals).join("\n")).toContain("worth mentioning");
  });

  it("says nothing about weight on an ordinary page", () => {
    const read = readLighthouse(
      report({}, {
        "total-byte-weight": { score: 0.9, numericValue: 400_000, displayValue: "Total size was 390 KiB" },
      }),
    );
    if (!read.ok) throw new Error("expected a reading");
    expect(summarise(read.signals).join("\n")).not.toContain("worth mentioning");
  });
});

suite("needsMeasuring", () => {
  const read = readLighthouse(report());
  if (!read.ok) throw new Error("fixture should read");
  const signals = { noHttps: false, lighthouse: read.signals };

  it("is true for a row nobody has measured", () => {
    expect(needsMeasuring({ website: "https://theroofingguy.co/", siteSignals: null })).toBe(true);
  });

  it("is false for a row already measured on the same site", () => {
    expect(needsMeasuring({ website: "https://theroofingguy.co/", siteSignals: signals })).toBe(false);
  });

  it("is true again when the site moved, so the reading is about a dead server", () => {
    // Otherwise the row is skipped for ever and is never offered a signal again.
    expect(needsMeasuring({ website: "https://theroofingguy.com/", siteSignals: signals })).toBe(true);
  });

  it("is false with no website, because there is nothing to open", () => {
    expect(needsMeasuring({ website: null, siteSignals: null })).toBe(false);
  });
});
