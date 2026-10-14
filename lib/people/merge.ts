import { domainOf, isPersonalEmail } from "./email-pattern";
import type { Findings, PersonFinding } from "./providers/types";
import { isDecisionMaker } from "./seniority";

const key = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");
const rank = (status?: string) => (status === "verified" ? 2 : status === "guessed" ? 1 : 0);

/**
 * One picture from several providers. The same person found twice is one
 * person. An address the company published beats one inferred from a
 * pattern, and every fact is kept, so the source of each field survives.
 */
export function mergeFindings(into: Findings, add: Findings): Findings {
  const people = new Map<string, PersonFinding>(into.people.map((p) => [key(p.name), { ...p, facts: [...p.facts] }]));
  for (const p of add.people) {
    const current = people.get(key(p.name));
    if (!current) {
      people.set(key(p.name), { ...p, facts: [...p.facts] });
      continue;
    }
    current.title ??= p.title;
    if (p.email && rank(p.emailStatus) > rank(current.emailStatus)) {
      current.email = p.email;
      current.emailStatus = p.emailStatus;
    }
    current.phone ??= p.phone;
    current.linkedinUrl ??= p.linkedinUrl;
    current.facts.push(...p.facts);
  }

  const company = {
    ...into.company,
    signals: { ...into.company.signals },
    facts: [...into.company.facts, ...add.company.facts],
  };
  company.industry ??= add.company.industry;
  company.location ??= add.company.location;
  company.sizeBand ??= add.company.sizeBand;
  for (const [signal, value] of Object.entries(add.company.signals)) {
    // A signal any source saw stands. Otherwise the first answer fills the gap.
    if (value === true || company.signals[signal] === undefined) company.signals[signal] = value;
  }
  return { people: [...people.values()], company };
}

export interface Blocklist {
  /** Addresses on the do-not-contact list, and addresses that bounced. */
  emails: Set<string>;
  /** Whole domains on the do-not-contact list. */
  domains: Set<string>;
}

/**
 * What may be stored. Decision-makers only, business contacts only (no free
 * mailbox), and nothing on the do-not-contact list: an address someone asked
 * us not to use is not kept to be found again.
 */
export function applyGuardrails(findings: Findings, block: Blocklist): Findings {
  const allowed = (email: string) =>
    !isPersonalEmail(email) && !block.emails.has(email.toLowerCase()) && !block.domains.has(domainOf(email));

  const people = findings.people
    .filter((p) => isDecisionMaker(p.title))
    .map((p) => {
      if (!p.email || allowed(p.email)) return p;
      const { email: _email, emailStatus: _status, ...rest } = p;
      return { ...rest, facts: p.facts.filter((f) => f.field !== "email") };
    });
  const facts = findings.company.facts.filter((f) => f.field !== "email" || allowed(f.value));
  return { people, company: { ...findings.company, facts } };
}
