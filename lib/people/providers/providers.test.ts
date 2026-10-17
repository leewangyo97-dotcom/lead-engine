import { describe, expect, it } from "vitest";
import { edgarProvider, filingUrl, matchFiling, normalizeCompanyName, parseFormD } from "./edgar";
import { emailPatternProvider } from "./email-pattern";
import { blogMatches, githubProvider, repoSignals } from "./github";
import { emptyFindings, type CompanyRef, type ProviderContext } from "./types";
import { cleanTitle, extractCompany, extractPeople, keyPages, looksLikeName, websiteProvider } from "./website";

const ACME: CompanyRef = { id: "c1", name: "Acme Dental", domain: "acmedental.com.au", countryCode: "AU" };
const NOW = new Date("2026-10-14T00:00:00Z");

const TEAM = `<!doctype html><html><head><meta name="viewport" content="width=device-width">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Dentist","name":"Acme Dental",
 "founder":{"@type":"Person","name":"Grace Lim","email":"grace@acmedental.com.au"}}</script></head><body>
<div class="card"><h3>Jane Doe</h3><p>Principal Dentist &amp; Owner</p>
  <a href="mailto:jane.doe@acmedental.com.au">Email</a> <a href="tel:+61290001111">Call</a>
  <a href="https://www.linkedin.com/in/janedoe">LinkedIn</a></div>
<div class="card"><h3>Tom Reyes</h3><p>Dental Assistant</p><a href="mailto:tom.reyes@acmedental.com.au">Email</a></div>
<div class="card"><h4>Raj Patel, Practice Director</h4><a href="mailto:rajpatel@gmail.com">Email</a></div>
<div><h3>Meet Our Team</h3><p>Director of everything</p></div>
<footer>© 2025 Acme Dental · <a href="mailto:info@acmedental.com.au">info@acmedental.com.au</a>
  <a href="tel:0290002222">(02) 9000 2222</a> We're hiring a mobile engineer — see careers.</footer>
</body></html>`;

describe("website provider", () => {
  it("reads people from schema.org data and from team cards, with their business contacts", () => {
    const people = extractPeople(TEAM, "https://acmedental.com.au/team", ACME);
    const byName = Object.fromEntries(people.map((p) => [p.name, p]));
    expect(byName["Grace Lim"]).toMatchObject({ title: "Founder", email: "grace@acmedental.com.au", emailStatus: "verified" });
    expect(byName["Jane Doe"]).toMatchObject({
      title: "Principal Dentist & Owner",
      email: "jane.doe@acmedental.com.au",
      phone: "+61290001111",
      linkedinUrl: "https://www.linkedin.com/in/janedoe",
    });
    // Every field says where it came from.
    expect(byName["Jane Doe"].facts.every((f) => f.sourceUrl === "https://acmedental.com.au/team" && f.sourceType === "website")).toBe(true);
  });

  it("keeps decision-makers only, and no personal mailbox", () => {
    const names = extractPeople(TEAM, "https://acmedental.com.au/team", ACME).map((p) => p.name);
    expect(names).not.toContain("Tom Reyes");
    expect(names).not.toContain("Meet Our Team");
    const raj = extractPeople(TEAM, "https://acmedental.com.au/team", ACME).find((p) => p.name === "Raj Patel");
    expect(raj?.title).toBe("Practice Director");
    expect(raj?.email).toBeUndefined();
  });

  it("knows a name from a heading", () => {
    expect(looksLikeName("Jane Doe")).toBe(true);
    expect(looksLikeName("Maria dela Cruz")).toBe(true);
    expect(looksLikeName("Our Services")).toBe(false);
    expect(looksLikeName("Acme Dental Pty Ltd")).toBe(false);
    // Headings saved as founders at Alta Roofing (17 Oct).
    expect(looksLikeName("Quality Materials")).toBe(false);
    expect(looksLikeName("The Alta Difference")).toBe(false);
    expect(looksLikeName("Dr Sue Fredericks")).toBe(true);
    expect(looksLikeName("PATRIK KIMMICH")).toBe(true);
  });

  it("follows the site's own key pages, team before contact, and nothing off-site", () => {
    const home = `<a href="/contact-us">Contact</a><a href="/our-team">Team</a><a href="https://other.com/team">x</a><a href="/blog">Blog</a>`;
    expect(keyPages(home, "https://acmedental.com.au/", "acmedental.com.au")).toEqual([
      "https://acmedental.com.au/our-team",
      "https://acmedental.com.au/contact-us",
    ]);
  });

  it("reads the company's desk addresses, numbers and need signals", () => {
    const company = extractCompany([{ url: "https://acmedental.com.au/", html: TEAM }], ACME, NOW);
    expect(company.facts.filter((f) => f.field === "email").map((f) => f.value)).toEqual(["info@acmedental.com.au"]);
    expect(company.facts.filter((f) => f.field === "phone").map((f) => f.value)).toContain("+61290002222");
    expect(company.signals).toMatchObject({ outdatedSite: false, noMobileApp: true, hiringDevelopers: true });
    const old = extractCompany([{ url: "u", html: "<footer>© 2019</footer>" }], ACME, NOW);
    expect(old.signals.outdatedSite).toBe(true);
  });

  it("needs a domain", () => {
    expect(websiteProvider.disabledReason({ ...ACME, domain: null }, {})).toBe("no website known");
  });
});

const fakeCtx = (mx: boolean): ProviderContext => ({
  fetchText: async () => null,
  hasMx: async () => mx,
  env: {},
  now: () => NOW,
});

describe("email-pattern provider", () => {
  const soFar = emptyFindings();
  soFar.people = [
    { name: "Jane Doe", email: "jane.doe@acmedental.com.au", emailStatus: "verified", facts: [] },
    { name: "Mark Tan", facts: [] },
  ];

  it("guesses from the published format, and marks the guess", async () => {
    const out = await emailPatternProvider.run(ACME, soFar, fakeCtx(true));
    expect(out.people).toHaveLength(1);
    expect(out.people[0]).toMatchObject({ name: "Mark Tan", email: "mark.tan@acmedental.com.au", emailStatus: "guessed" });
    expect(out.people[0].facts.map((f) => f.sourceType)).toEqual(["email_pattern", "email_pattern"]);
  });

  it("guesses nothing for a domain that receives no mail, or with nothing to learn from", async () => {
    expect((await emailPatternProvider.run(ACME, soFar, fakeCtx(false))).people).toEqual([]);
    const nothing = emptyFindings();
    nothing.people = [{ name: "Mark Tan", facts: [] }];
    expect((await emailPatternProvider.run(ACME, nothing, fakeCtx(true))).people).toEqual([]);
  });
});

const FORM_D = `<?xml version="1.0"?><edgarSubmission>
<primaryIssuer><cik>0001829334</cik><entityName>Supabase, Inc.</entityName>
 <issuerAddress><street1>970 Toa Payoh</street1><city>SAN FRANCISCO</city><stateOrCountry>CA</stateOrCountry>
 <stateOrCountryDescription>CALIFORNIA</stateOrCountryDescription></issuerAddress>
 <issuerPhoneNumber>415-000-0000</issuerPhoneNumber></primaryIssuer>
<relatedPersonsList>
 <relatedPersonInfo><relatedPersonName><firstName>Paul</firstName><lastName>Copplestone</lastName></relatedPersonName>
  <relatedPersonRelationshipList><relationship>Executive Officer</relationship><relationship>Director</relationship></relatedPersonRelationshipList></relatedPersonInfo>
 <relatedPersonInfo><relatedPersonName><firstName>Ant</firstName><lastName>Wilson</lastName></relatedPersonName>
  <relatedPersonRelationshipList><relationship>Executive Officer</relationship></relatedPersonRelationshipList>
  <relationshipClarification>CTO</relationshipClarification></relatedPersonInfo>
 <relatedPersonInfo><relatedPersonName><firstName>Some</firstName><lastName>Promoter</lastName></relatedPersonName>
  <relatedPersonRelationshipList><relationship>Promoter</relationship></relatedPersonRelationshipList></relatedPersonInfo>
</relatedPersonsList>
<offeringData><industryGroup><industryGroupType>Other Technology</industryGroupType></industryGroup>
 <offeringSalesAmounts><totalAmountSold>30000000</totalAmountSold></offeringSalesAmounts>
 <signatureBlock><signature><nameOfSigner>Paul Copplestone</nameOfSigner><signatureTitle>CEO</signatureTitle></signature></signatureBlock>
</offeringData></edgarSubmission>`;

describe("EDGAR provider", () => {
  const hit = (name: string, date: string, form = "D") => ({
    _source: { ciks: ["0001829334"], display_names: [`${name}  (CIK 0001829334)`], adsh: "0001805173-21-000002", file_date: date, form },
  });

  it("matches the company by name, newest Form D first", () => {
    expect(normalizeCompanyName("Supabase, Inc.")).toBe("supabase");
    const best = matchFiling([hit("Supabase, Inc.", "2021-09-10"), hit("Supabase Inc", "2025-03-01"), hit("Supabasement LLC", "2026-01-01")], "Supabase");
    expect(best?._source.file_date).toBe("2025-03-01");
    expect(filingUrl(best!)).toBe("https://www.sec.gov/Archives/edgar/data/1829334/000180517321000002/primary_doc.xml");
  });

  it("reads officers with their signed titles, and skips promoters", () => {
    const out = parseFormD(FORM_D, "https://sec.example/doc.xml", "2026-03-01", NOW);
    expect(out.people.map((p) => [p.name, p.title])).toEqual([
      ["Paul Copplestone", "CEO"],
      ["Ant Wilson", "CTO"],
    ]);
    expect(out.company).toMatchObject({ industry: "Other Technology", location: "SAN FRANCISCO, CALIFORNIA" });
    expect(out.company.signals.recentFunding).toBe(true);
    expect(out.company.facts.find((f) => f.field === "funding")?.value).toBe("Form D filed 2026-03-01, 30,000,000 USD sold");
  });

  it("calls an old round old", () => {
    expect(parseFormD(FORM_D, "u", "2021-09-10", NOW).company.signals.recentFunding).toBeUndefined();
  });

  it("runs only when SEC_USER_AGENT says who is asking, and only for US companies", () => {
    expect(edgarProvider.disabledReason(ACME, { SEC_USER_AGENT: "x y@z.com" })).toBe("EDGAR covers US companies");
    expect(edgarProvider.disabledReason({ ...ACME, countryCode: "US" }, {})).toMatch(/SEC_USER_AGENT/);
    expect(edgarProvider.disabledReason({ ...ACME, countryCode: null }, { SEC_USER_AGENT: "x y@z.com" })).toBeNull();
  });
});

describe("GitHub provider", () => {
  it("matches an organisation by its website, not its name alone", () => {
    expect(blogMatches("https://www.acmedental.com.au", "acmedental.com.au")).toBe(true);
    expect(blogMatches("acmedental.com.au", "acmedental.com.au")).toBe(true);
    expect(blogMatches("https://acme.io", "acmedental.com.au")).toBe(false);
    expect(blogMatches(null, "acmedental.com.au")).toBe(false);
  });

  it("reads the stack and recent activity from own repositories, not forks", () => {
    const repos = [
      { language: "TypeScript", pushed_at: "2026-10-01T00:00:00Z", fork: false },
      { language: "TypeScript", pushed_at: "2026-01-01T00:00:00Z", fork: false },
      { language: "Kotlin", pushed_at: "2025-01-01T00:00:00Z", fork: false },
      { language: "Go", pushed_at: "2026-10-10T00:00:00Z", fork: true },
    ];
    expect(repoSignals(repos, NOW)).toEqual({ techStack: ["TypeScript", "Kotlin"], activeOnGithub: true });
  });

  it("stays off without a token", () => {
    expect(githubProvider.disabledReason(ACME, {})).toMatch(/GITHUB_TOKEN/);
  });
});

describe("website provider, plain-text contacts", () => {
  it("reads printed numbers on a contact page, and not drawing data", () => {
    const html = `<body><p>PHONE: 03 9795 6776</p><p>EMAIL: hello@acmedental.com.au</p>
      <svg><path d="M12.0226 13.4259 13.1275 13.7242"/></svg><script>{"v":"+61466243566"}</script></body>`;
    const company = extractCompany([{ url: "https://acmedental.com.au/contact-us/", html }], ACME, NOW);
    expect(company.facts.filter((f) => f.field === "phone").map((f) => f.value)).toEqual(["+61397956776"]);
    expect(company.facts.filter((f) => f.field === "email").map((f) => f.value)).toEqual(["hello@acmedental.com.au"]);
  });
});

describe("cleanTitle", () => {
  it("drops a licence number after the role", () => {
    expect(cleanTitle("CO-OWNER - DEN 0002084625")).toBe("CO-OWNER");
  });

  it("reduces a sentence standing in for a title to the role it names", () => {
    expect(cleanTitle("Hi there! I’m the founder of Smile Me Dental.")).toBe("Founder");
    expect(cleanTitle("We are a family business and you will love us.")).toBe("");
  });

  it("leaves a real title as it is", () => {
    expect(cleanTitle("Medical Director and Anatomical Pathologist")).toBe("Medical Director and Anatomical Pathologist");
    expect(cleanTitle(", CEO • Apr 29")).toBe("CEO");
  });
});
