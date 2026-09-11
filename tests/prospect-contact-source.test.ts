import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The email button has now been broken twice in the same way, and neither break
 * was visible from any unit test — there is no DOM test setup here, and the
 * failure was a browser behaviour rather than a wrong value.
 *
 * What both breaks have in common is a shape in the source, so this checks the
 * shape.
 *
 * 1. `window.open("", "_blank")` then a `mailto:` on the popup. Browsers ignore
 *    it; the click did nothing.
 * 2. `window.location.href = "mailto:..."` followed immediately by
 *    `router.refresh()`. With no mail client registered the assignment does
 *    nothing, and the refresh removed the row — logging a contact sets the
 *    prospect to `contacted`, and the queue only lists `new` — so the fallback
 *    address was unmounted before anyone could read it. A click that spends a
 *    prospect and leaves nothing on screen.
 *
 * The rule that comes out of it: after an email is logged, the person must be
 * left holding something they can act on. A real anchor, and no refresh until
 * they dismiss it.
 */
const SOURCE = readFileSync("app/components/prospect-contact.tsx", "utf8");

/** The body of `async function open(...)`, up to the next top-level function. */
function openBody(): string {
  const start = SOURCE.indexOf("async function open(");
  expect(start).toBeGreaterThan(-1);
  const rest = SOURCE.slice(start);

  // The earliest of several markers, not one of them. This used to cut at
  // `if (declined)`; when an `undecline` function was added between the two, the
  // range quietly grew to include it and reported that function's
  // `router.refresh()` as a violation inside `open`. A guard that reads the
  // wrong range fails on innocent code, which is the fastest way to get a guard
  // deleted.
  const ends = ["\n  async function ", "\n  function ", "\n  if (declined)"]
    .map((marker) => rest.indexOf(marker, 1))
    .filter((i) => i > 0);

  return ends.length ? rest.slice(0, Math.min(...ends)) : rest;
}

describe("the prospect email path", () => {
  it("assigns a href to a window only inside the whatsapp branch", () => {
    // Both old shapes were an assignment reached on the email path: first the
    // blank popup, then the current window. Every assignment must now sit
    // between the whatsapp guard and the point where the email path takes over.
    const body = openBody();
    const whatsappFrom = body.indexOf('channel === "whatsapp"');
    const emailFrom = body.indexOf("setSent({");
    expect(whatsappFrom).toBeGreaterThan(-1);
    expect(emailFrom).toBeGreaterThan(whatsappFrom);

    const assignments = [...body.matchAll(/location\.href\s*=/g)];
    expect(assignments.length).toBeGreaterThan(0);
    for (const match of assignments) {
      expect(match.index).toBeGreaterThan(whatsappFrom);
      expect(match.index).toBeLessThan(emailFrom);
    }
  });

  it("keeps the whatsapp tab, which is a web page and does load", () => {
    expect(openBody()).toMatch(/channel === "whatsapp"/);
    expect(openBody()).toMatch(/window\.open\(""/);
  });

  it("hands the email href to state rather than to the browser", () => {
    expect(openBody()).toMatch(/setSent\(\{\s*href: data\.href/);
  });

  it("does not refresh on the email branch", () => {
    // The refresh belongs to whatsapp and to the dismiss button. One here would
    // unmount the row and take the address with it.
    const body = openBody();
    const emailBranch = body.slice(body.indexOf("setSent({"));
    expect(emailBranch).not.toMatch(/router\.refresh\(\)/);
  });

  it("renders a real anchor carrying the mailto, and the address beside it", () => {
    expect(SOURCE).toMatch(/<a\s+href=\{sent\.href\}/);
    expect(SOURCE).toMatch(/\{sent\.to\}/);
  });

  it("refreshes only when the panel is dismissed", () => {
    // Adjacency is not the property — the dismiss handler also resets the
    // "marked sent" flag now. What matters is that clearing the panel and
    // refreshing happen together, in that handler and nowhere earlier.
    const dismiss = SOURCE.slice(SOURCE.indexOf("setSent(null);"));
    expect(dismiss).toMatch(/setSent\(null\);[\s\S]{0,120}router\.refresh\(\);/);
  });

  it("offers the Gmail draft and the mailto fallback as different outcomes", () => {
    // A draft in the account and a link handed to the browser mean different
    // things about whether this prospect has been written to, so the panel has
    // to say which happened rather than print one sentence for both.
    expect(SOURCE).toMatch(/sent\.mode === "gmail-draft"/);
    expect(SOURCE).toMatch(/Nothing has been sent/);
  });

  it("only offers to start the follow-up clock on the Gmail branch", () => {
    // The mailto branch already recorded a send; asking again there would let
    // one message be counted twice.
    const gmail = SOURCE.slice(
      SOURCE.indexOf('sent.mode === "gmail-draft"'),
      SOURCE.indexOf("Logged. Open it in your mail app"),
    );
    expect(gmail).toContain("/sent`");
    expect(SOURCE.slice(SOURCE.indexOf("Logged. Open it in your mail app"))).not.toContain("/sent`");
  });
});
