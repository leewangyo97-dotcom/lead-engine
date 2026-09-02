import { describe, expect, it, beforeEach } from "vitest";
import {
  extractEmails,
  extractPhones,
  extractSiteSignals,
  extractSocials,
  extractWhatsApp,
  stripTags,
} from "./extract";
import { clearRobotsCache, getRobots, isAllowed, parseRobots } from "./robots";
import { contactLinks, enrichSite } from "./enrich";

describe("extractEmails", () => {
  it("prefers a mailto: link and records that it was one", () => {
    const html = `<a href="mailto:hello@vetcebu.ph">Email us</a>`;
    expect(extractEmails(html)).toEqual([{ email: "hello@vetcebu.ph", confidence: "mailto" }]);
  });

  it("falls back to body text, marked as the weaker source", () => {
    const html = `<p>Write to clinic@vetcebu.ph anytime</p>`;
    expect(extractEmails(html)).toEqual([{ email: "clinic@vetcebu.ph", confidence: "text" }]);
  });

  it("does not report the same address twice at two confidences", () => {
    const html = `<a href="mailto:a@b.ph">a@b.ph</a>`;
    expect(extractEmails(html)).toHaveLength(1);
    expect(extractEmails(html)[0].confidence).toBe("mailto");
  });

  it("rejects the junk a naive regex finds", () => {
    // Each of these appeared on a real page and is not a business address.
    const html = `
      <img srcset="logo@2x.png 2x" src="hero@2x.jpg">
      <link href="https://cdn.example/style@1x.css">
      <p>example@example.com — your@email.com — noreply@wixpress.com</p>
      <script>Sentry.init({dsn:"https://k@o123.ingest.sentry.io/1"})</script>`;
    expect(extractEmails(html)).toEqual([]);
  });

  it("ignores addresses inside script and style blocks", () => {
    const html = `<style>/* theme by dev@agency.com */</style><p>no contact here</p>`;
    expect(extractEmails(html)).toEqual([]);
  });

  it("decodes a percent-encoded mailto", () => {
    const html = `<a href="mailto:info%40clinic.ph?subject=Hi">mail</a>`;
    expect(extractEmails(html)[0].email).toBe("info@clinic.ph");
  });
});

describe("extractWhatsApp", () => {
  it("reads a wa.me link as a confirmed WhatsApp number", () => {
    const html = `<a href="https://wa.me/639171234567">Chat</a>`;
    expect(extractWhatsApp(html, "PH")).toBe("+639171234567");
  });

  it("reads the api.whatsapp.com form widgets generate", () => {
    const html = `<a href="https://api.whatsapp.com/send?phone=639171234567&text=Hi">Chat</a>`;
    expect(extractWhatsApp(html, "PH")).toBe("+639171234567");
  });

  it("returns nothing when the linked number is not valid", () => {
    // Opening a chat with a malformed number fails only after the user clicks.
    expect(extractWhatsApp(`<a href="https://wa.me/123">x</a>`, "PH")).toBeNull();
  });

  it("finds no number when there is no WhatsApp link", () => {
    expect(extractWhatsApp(`<a href="tel:+639171234567">call</a>`, "PH")).toBeNull();
  });
});

describe("extractPhones", () => {
  it("reads tel: links", () => {
    expect(extractPhones(`<a href="tel:+63 32 238 2289">call</a>`, "PH")).toContain("+63322382289");
  });

  it("reads a plain number from page text", () => {
    expect(extractPhones(`<p>Call us on (032) 238 2289</p>`, "PH")).toContain("+63322382289");
  });

  it("does not turn dates and prices into phone numbers", () => {
    const html = `<p>Open since 12.03.2019. Consultation 1 500.00 pesos.</p>`;
    expect(extractPhones(html, "PH")).toEqual([]);
  });
});

describe("extractSocials", () => {
  it("picks up the three profile types", () => {
    const html = `
      <a href="https://facebook.com/vetcebu">fb</a>
      <a href="https://www.instagram.com/vetcebu">ig</a>
      <a href="https://linkedin.com/company/vetcebu">li</a>`;
    const s = extractSocials(html);
    expect(s.facebook).toContain("facebook.com/vetcebu");
    expect(s.instagram).toContain("instagram.com/vetcebu");
    expect(s.linkedin).toContain("linkedin.com/company/vetcebu");
  });

  it("leaves fields undefined rather than guessing", () => {
    expect(extractSocials(`<p>nothing</p>`)).toEqual({
      facebook: undefined,
      instagram: undefined,
      linkedin: undefined,
    });
  });
});

describe("extractSiteSignals", () => {
  it("notices a missing viewport meta", () => {
    expect(extractSiteSignals(`<head><title>x</title></head>`, "https://a.ph").noViewport).toBe(
      true,
    );
    const responsive = `<meta name="viewport" content="width=device-width">`;
    expect(extractSiteSignals(responsive, "https://a.ph").noViewport).toBe(false);
  });

  it("reports plain http as a fact about the URL", () => {
    expect(extractSiteSignals("", "http://a.ph").noHttps).toBe(true);
    expect(extractSiteSignals("", "https://a.ph").noHttps).toBe(false);
  });

  it("identifies the platform from its own asset paths", () => {
    expect(extractSiteSignals(`<link href="/wp-content/x.css">`, "https://a.ph").platform).toBe(
      "wordpress",
    );
    expect(extractSiteSignals(`<img src="//static.wixstatic.com/x">`, "https://a.ph").platform).toBe(
      "wix",
    );
    expect(extractSiteSignals(`<p>hand written</p>`, "https://a.ph").platform).toBeUndefined();
  });
});

describe("stripTags", () => {
  it("removes scripts, styles and markup", () => {
    const html = `<script>var a=1</script><style>p{}</style><p>Hello&nbsp;there</p>`;
    expect(stripTags(html).trim()).toBe("Hello there");
  });
});

describe("parseRobots", () => {
  it("applies the wildcard group", () => {
    const rules = parseRobots("User-agent: *\nDisallow: /admin\n");
    expect(isAllowed(rules, "/admin/login")).toBe(false);
    expect(isAllowed(rules, "/contact")).toBe(true);
  });

  it("prefers a group naming us over the wildcard", () => {
    const text = "User-agent: *\nDisallow: /\n\nUser-agent: lead-engine\nDisallow: /private\n";
    const rules = parseRobots(text, "lead-engine");
    expect(isAllowed(rules, "/contact")).toBe(true);
    expect(isAllowed(rules, "/private/x")).toBe(false);
  });

  it("lets a longer Allow override a shorter Disallow", () => {
    const rules = parseRobots("User-agent: *\nDisallow: /a\nAllow: /a/public\n");
    expect(isAllowed(rules, "/a/secret")).toBe(false);
    expect(isAllowed(rules, "/a/public/page")).toBe(true);
  });

  it("ignores comments and blank lines", () => {
    const rules = parseRobots("# hi\n\nUser-agent: *   # all\nDisallow: /x\n");
    expect(isAllowed(rules, "/x")).toBe(false);
  });

  it("reads Crawl-delay but caps it, so one site cannot stall the run", () => {
    expect(parseRobots("User-agent: *\nCrawl-delay: 2\n").crawlDelayMs).toBe(2000);
    expect(parseRobots("User-agent: *\nCrawl-delay: 3600\n").crawlDelayMs).toBe(10_000);
  });

  it("treats an empty Disallow as permission", () => {
    expect(isAllowed(parseRobots("User-agent: *\nDisallow:\n"), "/anything")).toBe(true);
  });
});

describe("getRobots", () => {
  beforeEach(() => clearRobotsCache());

  it("treats a 404 as no rules rather than as a refusal", async () => {
    const fetchImpl = (async () => new Response("nope", { status: 404 })) as unknown as typeof fetch;
    expect(isAllowed(await getRobots("https://a.ph", fetchImpl), "/contact")).toBe(true);
  });

  it("treats a network failure as no rules", async () => {
    const fetchImpl = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    expect(isAllowed(await getRobots("https://b.ph", fetchImpl), "/")).toBe(true);
  });

  it("ignores an HTML page served in place of robots.txt", async () => {
    // Some hosts answer every path with their 404 template, at status 200.
    const fetchImpl = (async () =>
      new Response("<!doctype html><p>Not found</p>", { status: 200 })) as unknown as typeof fetch;
    expect(isAllowed(await getRobots("https://c.ph", fetchImpl), "/admin")).toBe(true);
  });

  it("fetches once per origin", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      return new Response("User-agent: *\nDisallow: /x", { status: 200 });
    }) as unknown as typeof fetch;

    await getRobots("https://d.ph", fetchImpl);
    await getRobots("https://d.ph", fetchImpl);
    expect(calls).toBe(1);
  });
});

describe("contactLinks", () => {
  it("finds contact-ish paths on the same host", () => {
    const html = `<a href="/contact-us">Contact</a><a href="/about">About</a><a href="/shop">Shop</a>`;
    expect(contactLinks(html, "https://a.ph/")).toEqual([
      "https://a.ph/contact-us",
      "https://a.ph/about",
    ]);
  });

  it("does not follow a link to another host", () => {
    const html = `<a href="https://franchise-hq.com/contact">Contact</a>`;
    expect(contactLinks(html, "https://a.ph/")).toEqual([]);
  });

  it("caps how many pages one site can cost", () => {
    const html = `<a href="/contact">1</a><a href="/kontakt">2</a><a href="/about">3</a>
                  <a href="/reach-us">4</a>`;
    expect(contactLinks(html, "https://a.ph/").length).toBeLessThanOrEqual(2);
  });
});

/** A fetch stub answering from a map of URL to body. */
function stubFetch(pages: Record<string, string>, seen: string[] = []) {
  return (async (url: string | URL) => {
    const key = url.toString();
    seen.push(key);
    const body = pages[key];
    if (body === undefined) return new Response("", { status: 404 });
    return new Response(body, { status: 200, headers: { "content-type": "text/html" } });
  }) as unknown as typeof fetch;
}

describe("enrichSite", () => {
  beforeEach(() => clearRobotsCache());
  const nap = async () => {};

  it("reads contact details off a homepage", async () => {
    const fetchImpl = stubFetch({
      "https://vet.ph/robots.txt": "User-agent: *\nDisallow:",
      "https://vet.ph/": `<a href="mailto:hi@vet.ph">mail</a>
                          <a href="https://wa.me/639171234567">chat</a>
                          <meta name="viewport" content="width=device-width">`,
    });

    const out = await enrichSite("https://vet.ph/", "PH", { fetchImpl, sleep: nap });
    expect(out.status).toBe("enriched");
    expect(out.email).toBe("hi@vet.ph");
    expect(out.whatsappE164).toBe("+639171234567");
    expect(out.signals?.noViewport).toBe(false);
  });

  it("follows one contact page when the homepage has no email", async () => {
    const seen: string[] = [];
    const fetchImpl = stubFetch(
      {
        "https://vet.ph/robots.txt": "User-agent: *\nDisallow:",
        "https://vet.ph/": `<a href="/contact">Contact</a>`,
        "https://vet.ph/contact": `<a href="mailto:hi@vet.ph">mail</a>`,
      },
      seen,
    );

    const out = await enrichSite("https://vet.ph/", "PH", { fetchImpl, sleep: nap });
    expect(out.email).toBe("hi@vet.ph");
    expect(seen).toContain("https://vet.ph/contact");
  });

  it("does not spend a request on a contact page when the homepage already answered", async () => {
    const seen: string[] = [];
    const fetchImpl = stubFetch(
      {
        "https://vet.ph/robots.txt": "User-agent: *\nDisallow:",
        "https://vet.ph/": `<a href="mailto:hi@vet.ph">mail</a><a href="/contact">Contact</a>`,
        "https://vet.ph/contact": `<a href="mailto:other@vet.ph">mail</a>`,
      },
      seen,
    );

    await enrichSite("https://vet.ph/", "PH", { fetchImpl, sleep: nap });
    expect(seen).not.toContain("https://vet.ph/contact");
  });

  it("stops at robots.txt when the site refuses", async () => {
    const seen: string[] = [];
    const fetchImpl = stubFetch(
      {
        "https://no.ph/robots.txt": "User-agent: *\nDisallow: /",
        "https://no.ph/": `<a href="mailto:hi@no.ph">mail</a>`,
      },
      seen,
    );

    const out = await enrichSite("https://no.ph/", "PH", { fetchImpl, sleep: nap });
    expect(out.status).toBe("robots_blocked");
    expect(out.email).toBeUndefined();
    // The homepage must not have been requested at all.
    expect(seen).toEqual(["https://no.ph/robots.txt"]);
  });

  it("reports a site with no contact details apart from one that failed", async () => {
    const fetchImpl = stubFetch({
      "https://bare.ph/robots.txt": "User-agent: *\nDisallow:",
      "https://bare.ph/": `<p>Open daily</p>`,
    });
    expect((await enrichSite("https://bare.ph/", "PH", { fetchImpl, sleep: nap })).status).toBe(
      "no_contact_found",
    );
  });

  it("reports a fetch failure rather than throwing", async () => {
    const fetchImpl = (async (url: string | URL) => {
      if (url.toString().endsWith("robots.txt")) return new Response("", { status: 404 });
      throw new Error("ETIMEDOUT");
    }) as unknown as typeof fetch;

    expect((await enrichSite("https://down.ph/", "PH", { fetchImpl, sleep: nap })).status).toBe(
      "fetch_failed",
    );
  });

  it("treats a missing or unparseable website as no website, not a failure", async () => {
    const fetchImpl = stubFetch({});
    expect((await enrichSite(null, "PH", { fetchImpl })).status).toBe("no_website");
    expect((await enrichSite("not a url", "PH", { fetchImpl })).status).toBe("no_website");
    // A Facebook page stored as the website has no robots.txt worth reading.
    expect((await enrichSite("ftp://x.ph", "PH", { fetchImpl })).status).toBe("no_website");
  });

  it("calls a 403 a refusal, not a failure", async () => {
    // Franchise sites answer a self-identifying crawler with 403. Recording it
    // as a failure says the site is broken and invites a retry that will be
    // refused again.
    for (const status of [401, 403, 451]) {
      const fetchImpl = (async (url: string | URL) => {
        if (url.toString().endsWith("robots.txt")) return new Response("", { status: 404 });
        return new Response("nope", { status, headers: { "content-type": "text/html" } });
      }) as unknown as typeof fetch;

      expect((await enrichSite("https://franchise.example/", "PH", { fetchImpl, sleep: nap })).status).toBe(
        "site_refused",
      );
    }
  });

  it("still calls a 404 or a 500 a failure", async () => {
    for (const status of [404, 500, 502]) {
      const fetchImpl = (async (url: string | URL) => {
        if (url.toString().endsWith("robots.txt")) return new Response("", { status: 404 });
        return new Response("", { status });
      }) as unknown as typeof fetch;

      expect((await enrichSite("https://gone.example/", "PH", { fetchImpl, sleep: nap })).status).toBe(
        "fetch_failed",
      );
    }
  });

  it("skips a non-HTML response instead of parsing a binary", async () => {
    const fetchImpl = (async (url: string | URL) => {
      if (url.toString().endsWith("robots.txt")) return new Response("", { status: 404 });
      return new Response("%PDF-1.4", {
        status: 200,
        headers: { "content-type": "application/pdf" },
      });
    }) as unknown as typeof fetch;

    expect((await enrichSite("https://pdf.ph/", "PH", { fetchImpl, sleep: nap })).status).toBe(
      "fetch_failed",
    );
  });
});
