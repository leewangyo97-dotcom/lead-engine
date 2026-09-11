import { describe, expect, it } from "vitest";
import { firstMessage } from "./contact";
import { verifyMessage } from "./message-verify";

const ok = (message: string, signals: string[]) => verifyMessage(message, signals).length === 0;

describe("verifyMessage", () => {
  it("catches the claim that actually shipped", () => {
    // This message was written, stored, and would have been sent. Her site
    // redirects to https, so every word about security was false.
    const message =
      "Hi Dr. Chu — your site is on plain http rather than https, so most browsers now show visitors a Not secure warning.";
    const violations = verifyMessage(message, ["website", "category", "mobile"]);

    expect(violations).toHaveLength(1);
    expect(violations[0].reason).toMatch(/security/);
  });

  it("allows the same claim when the site was measured insecure", () => {
    expect(
      ok("Your site is on plain http, so browsers show a warning.", ["website", "no_https"]),
    ).toBe(true);
  });

  it("refuses to say they have no website when they have one", () => {
    expect(ok("I noticed you don't have a website yet.", ["website"])).toBe(false);
    expect(ok("I noticed you don't have a website yet.", ["no_website"])).toBe(true);
  });

  it("refuses to refer to a website that is not in the record", () => {
    expect(ok("I had a quick look at your site.", ["no_website"])).toBe(false);
    expect(ok("I had a quick look at your site.", ["website"])).toBe(true);
  });

  it("only comments on phone rendering when a viewport tag was measured missing", () => {
    expect(ok("Your site is hard to use on a phone.", ["website"])).toBe(false);
    expect(ok("Your site is hard to use on a phone.", ["website", "no_viewport"])).toBe(true);
  });

  it("never allows reviews, hours, or a visit that did not happen", () => {
    // None of these are ever in the record, so no signal can justify them.
    expect(ok("I saw your great reviews on Google.", ["website", "no_website"])).toBe(false);
    expect(ok("I know you're open until 6pm.", ["website", "no_website"])).toBe(false);
    expect(ok("I walked past your shop yesterday.", ["website", "no_website"])).toBe(false);
  });

  it("never allows a claim of being local", () => {
    // PROFILE places him in Bulacan; the searches run in Cebu, Austin and Sydney.
    expect(ok("I'm a web developer here in Cebu.", ["no_website"])).toBe(false);
    expect(ok("I work with a lot of businesses in your area.", ["no_website"])).toBe(false);
    expect(ok("I'm a web developer here in the Philippines.", ["no_website"])).toBe(true);
  });

  it("passes the messages actually in use", () => {
    const noSite =
      "Hi Toledomed Cebu — Joshua here, a web developer in the Philippines. Patients looking for a clinic usually start on Google, and there's no page of yours for them to find. I could build you a one-pager with your services, hours and contact details, free to look at before you decide anything. Would that be useful?";
    expect(ok(noSite, ["no_website", "category"])).toBe(true);

    const hasSite =
      "Hi — Joshua here, a web developer. You already have a site for the tree service, so this isn't a rebuild pitch. Most trades lose enquiries at the same point: someone wants a quote at 9pm and there's no way to ask for one. A simple quote form that lands in your inbox usually fixes it. Want me to mock one up?";
    expect(ok(hasSite, ["website", "city", "category"])).toBe(true);
  });

  it("reports the offending words, not just that something is wrong", () => {
    const [violation] = verifyMessage("I saw your 5-star reviews", ["no_website"]);
    expect(violation.quote.toLowerCase()).toContain("review");
  });
});

describe("the honest framing of a missing website", () => {
  it("is allowed when no website is on file", () => {
    expect(verifyMessage("I couldn't find a website for you.", ["no_website"])).toEqual([]);
  });

  it("is allowed when the email domain suggests one, since that is the case for asking", () => {
    expect(verifyMessage("I couldn't find a website for you.", ["email_domain"])).toEqual([]);
  });

  it("is refused when their website is sitting in the record", () => {
    // Then the search did find one, and saying otherwise is not a softer claim,
    // it is a false account of what happened.
    const v = verifyMessage("I couldn't find a website for you.", ["website"]);
    expect(v).toHaveLength(1);
    expect(v[0].reason).toMatch(/one is on file/);
  });

  it("still refuses the assertive version without the signal", () => {
    expect(verifyMessage("You don't have a website.", ["website"])).toHaveLength(1);
  });
});

describe("the template the app actually sends", () => {
  it("passes its own verifier for a prospect with no website", () => {
    // The generated message and the rules that judge it live in different files
    // and have drifted before. This ties them together: if either moves, this
    // fails rather than a real business receiving the result.
    const message = firstMessage({ name: "Aku Inn", city: "Cebu City" });
    expect(verifyMessage(message, ["no_website", "category", "city"])).toEqual([]);
  });

  it("is refused for a prospect whose website is on file", () => {
    const message = firstMessage({ name: "Aku Inn", city: "Cebu City" });
    expect(verifyMessage(message, ["website"]).length).toBeGreaterThan(0);
  });

  it("passes for a prospect that does have a website", () => {
    const message = firstMessage({ name: "CDW Studios", website: "https://cdwstudios.com/" });
    expect(verifyMessage(message, ["website"])).toEqual([]);
  });
});

describe("claims about weight and speed", () => {
  const measured = ["website", "page_weight"];

  it("allows the megabyte figure when Lighthouse measured it", () => {
    expect(
      verifyMessage("Your homepage pulls about 10 MB before it finishes loading.", measured),
    ).toHaveLength(0);
  });

  it("refuses the same sentence when nothing was measured", () => {
    const violations = verifyMessage("Your homepage pulls about 10 MB.", ["website"]);
    expect(violations).toHaveLength(1);
    expect(violations[0].reason).toContain("pnpm lh");
  });

  it("refuses a vague speed claim with no measurement behind it", () => {
    expect(verifyMessage("Your site is slow to load on a phone.", ["website"]).length).toBeGreaterThan(0);
  });

  it("refuses the performance score even with the measurement on file", () => {
    // There is no state of the record that makes this safe. The same dentist's
    // site scored 63, then 48, 56 and 52.
    const violations = verifyMessage("Your Lighthouse score is 61.", measured);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.reason.includes("fifteen points"))).toBe(true);
  });

  it("refuses a PageSpeed or Core Web Vitals mention too", () => {
    expect(verifyMessage("I ran PageSpeed on your site.", measured).length).toBeGreaterThan(0);
    expect(verifyMessage("Your Core Web Vitals are failing.", measured).length).toBeGreaterThan(0);
  });

  it("leaves ordinary wording alone", () => {
    // A rule that fires on innocent sentences trains you to pass --force. These
    // are the shapes the real drafts actually use.
    const innocent = [
      "I build booking pages for clinics and would be glad to show you one.",
      "Happy to put together a quick mockup if that is useful.",
      "I noticed your booking form and had one small idea about it.",
    ];
    for (const message of innocent) {
      expect(verifyMessage(message, ["website"])).toHaveLength(0);
    }
  });
});

describe("claims about contrast and readability", () => {
  const measured = ["website", "contrast"];

  it("allows the claim in the wording the signal itself supplies", () => {
    // "at phone width" is how `buildSignals` states the fact, and the phrasing
    // matters: it names the rendering the number came from without claiming
    // anything about how the site behaves there.
    expect(
      verifyMessage(
        "Forty elements on your homepage fail the contrast threshold at phone width.",
        measured,
      ),
    ).toHaveLength(0);
  });

  it("still blocks a usability claim about phones, measured contrast or not", () => {
    // Deliberate. Forty unreadable elements do not establish that a site is hard
    // to *use* on a phone — that is the viewport rule's question, and a contrast
    // measurement is not an answer to it.
    expect(verifyMessage("Your site is hard to use on a phone.", measured).length).toBeGreaterThan(0);
  });

  it("refuses it when nothing was measured", () => {
    const violations = verifyMessage("Some of your text is hard to read.", ["website"]);
    expect(violations).toHaveLength(1);
    expect(violations[0].reason).toContain("pnpm lh");
  });

  it("refuses an accessibility claim with nothing behind it", () => {
    expect(verifyMessage("Your site fails accessibility checks.", ["website"]).length).toBeGreaterThan(0);
    expect(verifyMessage("Screen readers cannot follow your menu.", ["website"]).length).toBeGreaterThan(0);
  });

  it("does not fire on offering to help, which asserts nothing", () => {
    // The rule has to catch the claim, not the topic. A draft that offers a
    // rebuild must not be blocked for naming what it would improve.
    const innocent = [
      "I build fast booking pages for trades and would be glad to show you one.",
      "Happy to send a mockup of how the homepage could look.",
      "I could put together a quick before-and-after if that is useful.",
    ];
    for (const message of innocent) expect(verifyMessage(message, ["website"])).toHaveLength(0);
  });
});
