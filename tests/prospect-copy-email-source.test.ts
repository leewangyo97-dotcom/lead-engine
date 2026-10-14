import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The row's Copy email button, checked by shape — there is no DOM test setup,
 * and what matters here is which calls happen on which click.
 *
 * Copying is not sending. The prospect queue lists only `new` rows and a send
 * sets `contacted`, so a copy that wrote anything would pull the business out of
 * the queue before a word reached them. The write belongs to "I sent it".
 */
const ROW = readFileSync("app/components/prospect-row-actions.tsx", "utf8");
const ROUTE = readFileSync("app/api/prospects/[id]/message/route.ts", "utf8");
const LOG = readFileSync("lib/places/outreach-log.ts", "utf8");

/** The text of `name`, from its declaration up to the next function at the same depth. */
function body(source: string, name: string): string {
  const start = source.indexOf(name);
  expect(start).toBeGreaterThan(-1);
  const rest = source.slice(start);
  const ends = ["\n  async function ", "\n  function ", "\n  // ", "\nexport ", "\nasync function ", "\n/**"]
    .map((marker) => rest.indexOf(marker, 1))
    .filter((i) => i > 0);
  return rest.slice(0, Math.min(...ends));
}

describe("Copy email", () => {
  const copy = body(ROW, "async function copyEmail(");
  const mark = body(ROW, "async function markSent(");

  it("reads the message with a GET and puts it on the clipboard", () => {
    expect(copy).toContain("fetch(`/api/prospects/${id}/message`)");
    expect(copy).not.toMatch(/method:/);
    expect(copy).toContain("toClipboard(data.body)");
  });

  it("leaves the row where it is — no refresh on copy", () => {
    expect(copy).not.toContain("router.refresh");
  });

  it("records the send only on 'I sent it', with a POST to the same address", () => {
    expect(mark).toContain('fetch(`/api/prospects/${id}/message`, { method: "POST" })');
    expect(ROW).toContain("I sent it — start the follow-up clock");
  });

  it("remembers a send across a reload: the row says it, and the panel stops offering it", () => {
    // 13 Oct: marked sent, reloaded, and "I sent it" was offered again.
    expect(ROW).toContain("const status = contactStatus(lastContact, canFollowUp);");
    expect(ROW).toMatch(/copied\.alreadySent \? \(/);
    expect(body(ROUTE, "export async function GET(")).toMatch(
      /alreadySent:\s*composed\.reopening && !composed\.awaiting && composed\.lastSentAt/,
    );
  });

  it("puts a copy icon beside the address and the subject", () => {
    expect(ROW).toContain('<CopyIcon text={copied.to} label="email address" />');
    expect(ROW).toContain('<CopyIcon text={copied.subject} label="subject" />');
  });

  it("shows the text when the browser refuses the clipboard, rather than failing quietly", () => {
    expect(ROW).toMatch(/!copied\.onClipboard && \(\s*<textarea/);
  });
});

describe("the message route", () => {
  it("writes nothing on GET", () => {
    const get = body(ROUTE, "export async function GET(");
    expect(get).toContain("composeContact(");
    expect(get).not.toMatch(/recordCopiedEmail|logContact|markProspectSent/);
  });

  it("records the copied email on POST", () => {
    expect(body(ROUTE, "export async function POST(")).toContain("recordCopiedEmail(");
  });
});

describe("composeContact", () => {
  it("wraps an email follow-up in what every email carries", () => {
    expect(LOG).toContain('channel === "email" && ladder ? asEmail(ladder) : ladder');
  });
});

describe("recordCopiedEmail", () => {
  const record = body(LOG, "export async function recordCopiedEmail(");

  it("composes the message on the server rather than trusting the browser's copy", () => {
    expect(record).toMatch(/composeContact\(prospectId, "email", now\)/);
    expect(record).not.toMatch(/request|json\(/);
  });

  it("marks an unconfirmed Email-click row sent instead of counting a second send", () => {
    expect(record).toMatch(/if \(!awaiting\) return \{ ok: true, alreadySent: true \}/);
    expect(record).toMatch(/set\(\{ sentAt: now\(\), subject, body \}\)/);
  });

  it("stamps sentAt on a new row, because the person has just said it went", () => {
    expect(record).toMatch(/sentAt: now\(\),\s*gmailDraftId: null/);
  });
});
