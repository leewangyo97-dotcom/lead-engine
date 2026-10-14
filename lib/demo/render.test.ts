import { afterEach, describe, expect, it, vi } from "vitest";
import { demoIneligible, demoSlug, renderDemo, type DemoPlace } from "./render";
import { DEFAULT_DEMO_BASE, demoUrlFor, publishedDemoUrl } from "./url";

const place = (over: Partial<DemoPlace> = {}): DemoPlace => ({
  id: "ab12cd34ef56gh78",
  name: "Bay Dental Studio",
  category: "dentists",
  city: "Sydney",
  addressLine: "1 Example Street, Sydney NSW",
  website: null,
  email: "hello@baydental.com.au",
  phoneE164: "+61290000000",
  whatsappE164: null,
  lat: -33.86,
  lon: 151.2,
  ...over,
});

describe("renderDemo", () => {
  it("says it is a demo, and keeps itself out of search results", () => {
    const { html } = renderDemo(place());
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(html).toContain("A free demo made for Bay Dental Studio by Joshua Senining");
    expect(html).toContain("This is not their official website.");
  });

  it("shows only what the listing holds, and labels every gap as a placeholder", () => {
    const { html } = renderDemo(place());
    expect(html).toContain("<h1>Bay Dental Studio</h1>");
    expect(html).toContain("Dentist · Sydney");
    expect(html).toContain("1 Example Street, Sydney NSW");
    expect(html).toContain("Your services go here.");
    expect(html).toContain("Your prices go here.");
    // Nothing the record does not hold.
    expect(html).not.toMatch(/opening hours|open (?:until|from)|reviews?|ratings?|testimonial|\$\d/i);
  });

  it("offers the ways in the listing has, best first", () => {
    const published = renderDemo(place({ whatsappE164: "+61412345678" })).html;
    expect(published).toMatch(/class="btn primary" href="https:\/\/wa\.me\/61412345678"/);
    const phoneOnly = renderDemo(place({ email: null })).html;
    expect(phoneOnly).toMatch(/class="btn primary" href="tel:\+61290000000">Call \+61 2 9000 0000/);
    expect(phoneOnly).not.toContain("mailto:");
    expect(renderDemo(place()).html).toContain("query=-33.86%2C151.2");
  });

  it("escapes what came from OpenStreetMap", () => {
    const { html } = renderDemo(place({ name: `Bad <script>alert("x")</script> & Co`, addressLine: "<b>1</b>" }));
    expect(html).not.toContain("<script>");
    expect(html).toContain("Bad &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; Co");
    expect(html).toContain("&lt;b&gt;1&lt;/b&gt;");
  });
});

describe("demoSlug", () => {
  it("is readable, and unique by the id it ends with", () => {
    expect(demoSlug(place())).toBe("bay-dental-studio-ab12cd");
    expect(demoSlug(place({ name: "Café Sol & Bakery!" }))).toBe("cafe-sol-bakery-ab12cd");
    expect(demoSlug(place({ name: "診所" }))).toBe("demo-ab12cd");
  });
});

describe("demoIneligible", () => {
  it("makes demos only for businesses without a site that may be contacted", () => {
    expect(demoIneligible(place())).toBeNull();
    expect(demoIneligible(place({ website: "https://x.com.au/" }))).toBe("they already have a website");
    expect(demoIneligible({ ...place(), status: "do_not_contact" })).toBe("on the do-not-contact list");
    expect(demoIneligible(place({ email: "office@det.nsw.edu.au" }))).toBe("a public body, not a prospect");
  });
});

describe("demo URLs", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("live on GitHub Pages until a custom domain is set", () => {
    vi.stubEnv("DEMO_BASE_URL", "");
    expect(demoUrlFor("bay-dental-studio-ab12cd")).toBe(`${DEFAULT_DEMO_BASE}/bay-dental-studio-ab12cd/`);
    vi.stubEnv("DEMO_BASE_URL", "https://demo.joshuasenining.dev/");
    expect(demoUrlFor("x-1")).toBe("https://demo.joshuasenining.dev/x-1/");
  });

  it("exist only once published", () => {
    expect(publishedDemoUrl({ demoSlug: "x-1", demoPublishedAt: null })).toBeNull();
    expect(publishedDemoUrl({ demoSlug: null, demoPublishedAt: new Date() })).toBeNull();
    expect(publishedDemoUrl({ demoSlug: "x-1", demoPublishedAt: new Date() })).toMatch(/\/x-1\/$/);
  });
});
