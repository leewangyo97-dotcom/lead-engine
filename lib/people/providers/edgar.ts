import * as cheerio from "cheerio";
import { emptyFindings, type Findings, type PeopleProvider, type PersonFinding } from "./types";

/**
 * SEC EDGAR Form D: US companies that recently raised money, and their
 * officers. A Form D is filed for an exempt offering (a startup round, for
 * instance), lists the executive officers and directors by name, and dates
 * the sale. That is both the "recent funding" signal and the people.
 *
 * Search uses EDGAR full-text search, which answers any client. The filing
 * itself is on www.sec.gov, which refuses undeclared tools ("Your Request
 * Originates from an Undeclared Automated Tool", seen 14 Oct). SEC fair-access
 * policy asks automated clients to state who they are, so this provider runs
 * only with SEC_USER_AGENT set, e.g. "Joshua Senining you@example.com". It
 * makes two requests per company, well under SEC's ten a second.
 *
 * Form D carries no email addresses and no personal contact details are kept:
 * names, roles, and the company's own published business phone.
 */
const SEARCH = "https://efts.sec.gov/LATEST/search-index";
const FUNDING_MONTHS = 18;

const SUFFIXES = /\b(inc|incorporated|llc|l\.l\.c|ltd|limited|pty|corp|corporation|co|company|plc|gmbh|lp|llp)\b\.?/g;

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(cik \d+\)/g, "")
    .replace(/[.,&'’]/g, " ")
    .replace(SUFFIXES, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

interface Hit {
  _source: { ciks: string[]; display_names: string[]; adsh: string; file_date: string; form: string };
}

/** The newest Form D filed under exactly this company's name, or null. */
export function matchFiling(hits: Hit[], companyName: string): Hit | null {
  const wanted = normalizeCompanyName(companyName);
  return (
    hits
      .filter((h) => h._source.form?.startsWith("D"))
      .filter((h) => h._source.display_names.some((n) => normalizeCompanyName(n) === wanted))
      .sort((a, b) => b._source.file_date.localeCompare(a._source.file_date))[0] ?? null
  );
}

export function filingUrl(hit: Hit): string {
  const cik = Number(hit._source.ciks[0]);
  return `https://www.sec.gov/Archives/edgar/data/${cik}/${hit._source.adsh.replace(/-/g, "")}/primary_doc.xml`;
}

/** Officers and directors from a Form D primary document, and what it says about the company. */
export function parseFormD(xml: string, url: string, fileDate: string, now: Date): Findings {
  const out = emptyFindings();
  const $ = cheerio.load(xml, { xml: true });
  const fact = (field: string, value: string) => ({ field, value, sourceUrl: url, sourceType: "edgar" as const });

  // A signer's own title ("CEO") is more precise than the form's role boxes.
  const signed = new Map<string, string>();
  $("signature").each((_, s) => {
    const name = $(s).find("nameOfSigner").text().trim().toLowerCase();
    const title = $(s).find("signatureTitle").text().trim();
    if (name && title) signed.set(name, title);
  });

  $("relatedPersonInfo").each((_, p) => {
    const first = $(p).find("relatedPersonName > firstName").text().trim();
    const last = $(p).find("relatedPersonName > lastName").text().trim();
    if (!first || !last) return;
    const name = `${first} ${last}`;
    const roles = $(p)
      .find("relatedPersonRelationshipList > relationship")
      .map((_, r) => $(r).text().trim())
      .get()
      .filter((r) => r !== "Promoter");
    if (roles.length === 0) return;
    const title =
      signed.get(name.toLowerCase()) ||
      $(p).find("relationshipClarification").text().trim() ||
      (roles.includes("Executive Officer") ? "Executive Officer" : roles.join(", "));
    const person: PersonFinding = { name, title, facts: [fact("name", name), fact("title", title)] };
    out.people.push(person);
  });

  const industry = $("industryGroupType").first().text().trim();
  if (industry) {
    out.company.industry = industry;
    out.company.facts.push(fact("industry", industry));
  }
  const city = $("primaryIssuer issuerAddress city").first().text().trim();
  // The spelled-out state first: the code ("CA") comes earlier in the document.
  const state =
    $("primaryIssuer issuerAddress stateOrCountryDescription").first().text().trim() ||
    $("primaryIssuer issuerAddress stateOrCountry").first().text().trim();
  if (city) {
    out.company.location = [city, state].filter(Boolean).join(", ");
    out.company.facts.push(fact("location", out.company.location));
  }
  const phone = $("primaryIssuer issuerPhoneNumber").first().text().trim();
  if (phone) out.company.facts.push(fact("phone", phone));

  const filed = new Date(fileDate);
  const months = (now.getTime() - filed.getTime()) / (30.44 * 86_400_000);
  if (months <= FUNDING_MONTHS) out.company.signals.recentFunding = true;
  const sold = $("totalAmountSold").first().text().trim();
  out.company.facts.push(
    fact("funding", `Form D filed ${fileDate}${sold ? `, ${Number(sold).toLocaleString("en-US")} USD sold` : ""}`),
  );
  return out;
}

export const edgarProvider: PeopleProvider = {
  name: "edgar",

  disabledReason(company, env) {
    if (!env.SEC_USER_AGENT) return "SEC_USER_AGENT is not set (SEC asks automated tools to say who they are)";
    if (company.countryCode && company.countryCode.toUpperCase() !== "US") return "EDGAR covers US companies";
    return null;
  },

  async run(company, _soFar, ctx): Promise<Findings> {
    const ua = { "User-Agent": ctx.env.SEC_USER_AGENT! };
    const query = `${SEARCH}?q=${encodeURIComponent(`"${company.name}"`)}&forms=D`;
    const search = await ctx.fetchText(query, { headers: ua, robots: false });
    if (!search) return emptyFindings();
    let hits: Hit[] = [];
    try {
      hits = JSON.parse(search.text).hits?.hits ?? [];
    } catch {
      return emptyFindings();
    }
    const hit = matchFiling(hits, company.name);
    if (!hit) return emptyFindings();
    const url = filingUrl(hit);
    const doc = await ctx.fetchText(url, { headers: ua, robots: false });
    return doc ? parseFormD(doc.text, url, hit._source.file_date, ctx.now()) : emptyFindings();
  },
};
