import { and, eq, inArray, ne, or } from "drizzle-orm";
import { getDb } from "../db";
import { companies, people, peopleSources, suppressions } from "../db/schema";
import { publicDomain } from "../places/public-institution";
import { createContext } from "./fetch";
import { applyGuardrails, mergeFindings, type Blocklist } from "./merge";
import { PROVIDERS } from "./providers";
import { emptyFindings, type PeopleProvider, type ProviderContext } from "./providers/types";
import { scorePerson } from "./score";
import { seniorityOf, type Seniority } from "./seniority";

/**
 * Discovers one company: run the providers, merge, apply the guardrails,
 * store people with every fact's source, and score them.
 *
 * Skipped outright: a public body (they do not hire this way, 14 Oct) and a
 * company whose domain is on the do-not-contact list. A provider that throws
 * costs its own findings, not the company's.
 */
export interface DiscoverResult {
  status: "done" | "skipped";
  reason?: string;
  people: number;
  providers: string[];
}

async function blocklist(): Promise<Blocklist> {
  const rows = await getDb()
    .select({ kind: suppressions.kind, value: suppressions.value })
    .from(suppressions)
    .where(or(eq(suppressions.kind, "email"), eq(suppressions.kind, "bounced"), eq(suppressions.kind, "domain")));
  return {
    emails: new Set(rows.filter((r) => r.kind !== "domain").map((r) => r.value.toLowerCase())),
    domains: new Set(rows.filter((r) => r.kind === "domain").map((r) => r.value.toLowerCase())),
  };
}

export async function discoverCompany(
  companyId: string,
  options: { providers?: PeopleProvider[]; ctx?: ProviderContext; now?: () => Date } = {},
): Promise<DiscoverResult> {
  const db = getDb();
  const now = options.now ?? (() => new Date());
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) return { status: "skipped", reason: "no such company", people: 0, providers: [] };
  if (company.domain && publicDomain(`x@${company.domain}`)) {
    return { status: "skipped", reason: "a public body", people: 0, providers: [] };
  }
  const block = await blocklist();
  if (company.domain && block.domains.has(company.domain)) {
    return { status: "skipped", reason: "on the do-not-contact list", people: 0, providers: [] };
  }

  const ctx = options.ctx ?? createContext();
  const ref = { id: company.id, name: company.name, domain: company.domain, countryCode: company.countryCode };
  let findings = emptyFindings();
  const ran: string[] = [];
  for (const provider of options.providers ?? PROVIDERS) {
    if (provider.disabledReason(ref, ctx.env)) continue;
    try {
      findings = mergeFindings(findings, await provider.run(ref, findings, ctx));
      ran.push(provider.name);
    } catch {
      // One source down is not a failed company.
    }
  }
  findings = applyGuardrails(findings, block);

  // The company: gaps filled, signals merged, never a known value erased.
  const signals = { ...(company.signals ?? {}), ...findings.company.signals };
  await db
    .update(companies)
    .set({
      industry: company.industry ?? findings.company.industry ?? null,
      location: company.location ?? findings.company.location ?? null,
      sizeBand: company.sizeBand ?? findings.company.sizeBand ?? null,
      signals,
      lastDiscoveredAt: now(),
      updatedAt: now(),
    })
    .where(eq(companies.id, company.id));

  // People: insert the new, update the found, and keep a person's status.
  const existing = await db.select().from(people).where(eq(people.companyId, company.id));
  const byName = new Map(existing.map((p) => [p.name.toLowerCase(), p]));
  const rank = (s: string | null | undefined) => (s === "verified" ? 2 : s === "guessed" ? 1 : 0);
  const ids = new Map<string, string>();
  for (const f of findings.people) {
    const current = byName.get(f.name.toLowerCase());
    const title = f.title ?? current?.title ?? null;
    const betterEmail = f.email && rank(f.emailStatus) >= rank(current?.emailStatus);
    const values = {
      title,
      seniority: seniorityOf(title),
      email: betterEmail ? f.email! : (current?.email ?? null),
      emailStatus: betterEmail ? f.emailStatus! : (current?.emailStatus ?? "unknown"),
      phone: f.phone ?? current?.phone ?? null,
      linkedinUrl: f.linkedinUrl ?? current?.linkedinUrl ?? null,
      updatedAt: now(),
    };
    if (current) {
      await db.update(people).set(values).where(eq(people.id, current.id));
      ids.set(f.name.toLowerCase(), current.id);
    } else {
      const [row] = await db
        .insert(people)
        .values({ companyId: company.id, name: f.name, ...values })
        .returning({ id: people.id });
      ids.set(f.name.toLowerCase(), row.id);
    }
  }

  // Sources: this run's facts replace the last run's from the same providers,
  // so a re-run refreshes provenance instead of piling it up.
  if (ran.length) {
    const personIds = [...ids.values(), ...existing.map((p) => p.id)];
    await db
      .delete(peopleSources)
      .where(
        and(
          inArray(peopleSources.sourceType, ran),
          or(
            eq(peopleSources.companyId, company.id),
            personIds.length ? inArray(peopleSources.personId, personIds) : eq(peopleSources.id, ""),
          ),
        ),
      );
  }
  const rows = [
    ...findings.people.flatMap((f) =>
      f.facts.map((fact) => ({ ...fact, personId: ids.get(f.name.toLowerCase())!, companyId: company.id, fetchedAt: now() })),
    ),
    ...findings.company.facts.map((fact) => ({ ...fact, personId: null, companyId: company.id, fetchedAt: now() })),
  ];
  for (let i = 0; i < rows.length; i += 200) await db.insert(peopleSources).values(rows.slice(i, i + 200));

  // Scores for everyone at the company: the company's signals changed for all.
  const everyone = await db
    .select()
    .from(people)
    .where(and(eq(people.companyId, company.id), ne(people.status, "do_not_contact")));
  for (const p of everyone) {
    const { score, reasons } = scorePerson(
      {
        seniority: p.seniority as Seniority,
        emailStatus: p.emailStatus as "verified" | "guessed" | "unknown",
        phone: p.phone,
        linkedinUrl: p.linkedinUrl,
      },
      { sizeBand: company.sizeBand, industry: company.industry ?? findings.company.industry, signals },
    );
    await db.update(people).set({ score, scoreReasons: reasons }).where(eq(people.id, p.id));
  }

  return { status: "done", people: findings.people.length, providers: ran };
}
