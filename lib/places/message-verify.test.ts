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
