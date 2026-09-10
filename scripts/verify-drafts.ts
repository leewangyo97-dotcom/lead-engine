import { eq } from "drizzle-orm";
import { getDb } from "../lib/db";
import { loadLocalEnv } from "../lib/env";
import { outreach, prospects } from "../lib/db/schema";
import { claimsOf, needsFetch, type Claim } from "../lib/places/draft-claims";
import { signalKeys } from "../lib/places/enhance";
import { extractEmails, extractPhones, extractSiteSignals, looksLikePage } from "../lib/places/extract";
import { verifyMessage } from "../lib/places/message-verify";
import { ownDomainFromEmail } from "../lib/places/own-domain";
import { OSM_USER_AGENT } from "../lib/places/nominatim";
import { DRAFT_STEP } from "../lib/places/outreach-log";

/**
 * Checks every unsent draft against the websites it talks about.
 *
 *   pnpm drafts:verify
 *
 * Two of nineteen drafts written on 10 September were false, and both were caught
 * by opening the site by hand. `verifyMessage` could not catch either: it checks
 * a message against the stored signals, so a message faithful to a wrong record
 * passes. This checks the record.
 *
 * One request per site, a second apart, with the same User-Agent the enricher
 * uses. Read-only — it never edits a draft or a prospect, because deciding what
 * to do about a false claim is a person's job and deleting someone's drafted
 * work on a heuristic is not a thing a script should do unattended.
 */
const PAUSE_MS = 1_000;
const TIMEOUT_MS = 20_000;

type Verdict = "ok" | "unverifiable" | "false";

interface Finding {
  name: string;
  verdict: Verdict;
  notes: string[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": OSM_USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const body = await res.text();
    return looksLikePage(body) ? body : null;
  } catch {
    return null;
  }
}

async function checkNoWebsite(
  name: string,
  email: string | null,
  notes: string[],
): Promise<Verdict> {
  const owned = ownDomainFromEmail(name, email);
  if (!owned) {
    notes.push("no website on file, and the email gives no domain to check");
    return "unverifiable";
  }

  const html = await fetchPage(`https://${owned}/`);
  if (html) {
    notes.push(`claims no website, but https://${owned}/ serves a page — the claim is false`);
    return "false";
  }
  notes.push(`email domain ${owned} does not serve a page`);
  return "ok";
}

async function checkSiteClaims(
  website: string,
  claims: readonly Claim[],
  notes: string[],
): Promise<Verdict> {
  const html = await fetchPage(website);
  if (!html) {
    // The failure that started this: signals measured on a body that was not a
    // page. Unreachable now is not proof the claim is wrong, but it is not
    // support for it either.
    notes.push(`${website} did not return a readable page, so its claims cannot be confirmed`);
    return "unverifiable";
  }

  let verdict: Verdict = "ok";
  const signals = extractSiteSignals(html, website);

  for (const claim of claims) {
    if (claim.kind === "no-viewport" && !signals.noViewport) {
      notes.push(`claims "${claim.quote}", but the page has a viewport tag — false`);
      verdict = "false";
    }
    if (claim.kind === "no-contact-details") {
      const contacts = [...extractEmails(html).map((e) => e.email), ...extractPhones(html, null)];
      if (contacts.length) {
        notes.push(`claims "${claim.quote}", but the page lists ${contacts[0]} — false`);
        verdict = "false";
      }
    }
  }

  return verdict;
}

async function main() {
  loadLocalEnv();
  const db = getDb();

  const rows = await db
    .select({
      id: prospects.id,
      name: prospects.name,
      email: prospects.email,
      website: prospects.website,
      category: prospects.category,
      city: prospects.city,
      phoneE164: prospects.phoneE164,
      whatsappE164: prospects.whatsappE164,
      siteSignals: prospects.siteSignals,
      enrichmentStatus: prospects.enrichmentStatus,
      body: outreach.body,
    })
    .from(outreach)
    .innerJoin(prospects, eq(prospects.id, outreach.prospectId))
    .where(eq(outreach.step, DRAFT_STEP));

  if (!rows.length) {
    console.log("drafts:verify: no unsent drafts");
    return;
  }

  console.log(`checking ${rows.length} draft(s)\n`);
  const findings: Finding[] = [];

  for (const row of rows) {
    const message = row.body ?? "";
    const notes: string[] = [];
    let verdict: Verdict = "ok";

    // The stored-signal check first: it costs nothing and catches a message that
    // drifted from the record without needing the network.
    for (const v of verifyMessage(message, signalKeys(row))) {
      notes.push(`against its own signals: "${v.quote}" — ${v.reason}`);
      verdict = "false";
    }

    const claims = claimsOf(message);
    if (claims.some((c) => c.kind === "no-website") && !row.website) {
      const r = await checkNoWebsite(row.name, row.email, notes);
      if (r === "false") verdict = "false";
      else if (r === "unverifiable" && verdict === "ok") verdict = "unverifiable";
      await sleep(PAUSE_MS);
    }

    if (row.website && needsFetch(claims)) {
      const r = await checkSiteClaims(row.website, claims, notes);
      if (r === "false") verdict = "false";
      else if (r === "unverifiable" && verdict === "ok") verdict = "unverifiable";
      await sleep(PAUSE_MS);
    }

    if (!claims.length) notes.push("makes no claim a fetch could settle");
    findings.push({ name: row.name, verdict, notes });
  }

  for (const f of findings) {
    const mark = f.verdict === "false" ? "FALSE" : f.verdict === "unverifiable" ? "unknown" : "ok";
    console.log(`${mark.padEnd(8)} ${f.name}`);
    for (const n of f.notes) console.log(`         ${n}`);
  }

  const bad = findings.filter((f) => f.verdict === "false");
  const unknown = findings.filter((f) => f.verdict === "unverifiable");
  console.log(
    `\n${findings.length} checked — ${bad.length} false, ${unknown.length} unverifiable, ` +
      `${findings.length - bad.length - unknown.length} confirmed`,
  );

  if (bad.length) {
    console.error("\nA false claim is a message that would be wrong to send. Delete or rewrite it.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("drafts:verify:", err instanceof Error ? err.message : err);
  process.exit(1);
});
