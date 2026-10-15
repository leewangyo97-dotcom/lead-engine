import { promises as dns } from "node:dns";

/**
 * Whether an email's domain can receive mail at all, asked of DNS.
 *
 * All three bounces on 14 Oct were addresses copied from the map listing, and
 * 3,541 of the 4,422 addresses on file come only from there, typed by whoever
 * edited the map, sometimes years ago. A domain with no mail server bounces
 * every message, and a bounce costs the Gmail account's reputation, so it is
 * found before anything is sent rather than after. Deterministic and free:
 * a DNS lookup, no mail server is contacted.
 */
export type MailDomain = "ok" | "dead" | "unknown";

/** What was checked, stored on the prospect. A different domain later is checked again. */
export interface EmailCheck {
  domain: string;
  mx: boolean;
  at: string;
}

export interface Resolver {
  resolveMx(domain: string): Promise<{ exchange: string; priority: number }[]>;
  resolve4(domain: string): Promise<string[]>;
  resolve6(domain: string): Promise<string[]>;
}

const code = (err: unknown) => (err as { code?: string })?.code;
// No such domain, or no records of the type asked for: answers, not failures.
const ANSWERED = new Set(["ENOTFOUND", "ENODATA"]);

export async function checkMailDomain(domain: string, resolver: Resolver = dns): Promise<MailDomain> {
  try {
    const mx = await resolver.resolveMx(domain);
    // A "null MX" (RFC 7505) is the domain saying it takes no mail at all.
    if (mx.length > 0) return mx.every((m) => m.exchange === "" || m.exchange === ".") ? "dead" : "ok";
  } catch (err) {
    if (code(err) === "ENOTFOUND") return "dead";
    if (code(err) !== "ENODATA") return "unknown";
  }
  // No MX record: mail falls back to the domain's own address (RFC 5321 §5.1),
  // so only a domain with no address either is dead.
  for (const lookup of [resolver.resolve4, resolver.resolve6]) {
    try {
      if ((await lookup.call(resolver, domain)).length > 0) return "ok";
    } catch (err) {
      if (!ANSWERED.has(code(err) ?? "")) return "unknown";
    }
  }
  return "dead";
}

let chosen: Promise<Resolver> | null = null;

/**
 * The system's resolver, or public ones when it refuses. Found on 15 Oct: on
 * the development machine the system resolver is 127.0.0.1 and refuses every
 * query, so 1,571 of 1,584 domains "did not answer". GitHub Actions resolves
 * normally. Decided once per process, by asking about a domain that is
 * certain to have mail.
 */
export function workingResolver(): Promise<Resolver> {
  chosen ??= dns.resolveMx("gmail.com").then(
    () => dns,
    (err) => {
      if (code(err) !== "ECONNREFUSED" && code(err) !== "ETIMEOUT") return dns;
      const fallback = new dns.Resolver({ timeout: 4000, tries: 2 });
      fallback.setServers(["1.1.1.1", "8.8.8.8"]);
      return fallback;
    },
  );
  return chosen;
}

export const domainOfEmail = (email: string | null | undefined) =>
  email?.split("@")[1]?.trim().toLowerCase().replace(/\.$/, "") ?? "";

/**
 * True when the address's domain was checked and has no mail server. A check
 * of some other domain (the address changed since) says nothing about this one.
 */
export function emailDomainDead(place: { email?: string | null; emailCheck?: EmailCheck | null }): boolean {
  const check = place.emailCheck;
  return !!place.email && !!check && check.mx === false && check.domain === domainOfEmail(place.email);
}

export const DEAD_DOMAIN_REASON = "their email domain has no mail server, so it would bounce";
