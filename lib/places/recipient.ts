import { and, desc, eq, gte, inArray, notInArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { companies, outreach, people, suppressions } from "../db/schema";
import type { Seniority } from "../people/seniority";

/**
 * Who a prospect's email goes to, and who it greets.
 *
 * Discovery (/people) finds the owners and directors behind a local business. A
 * message to a named owner, at an address they published, reads as written for
 * them; one to info@ reads as written for anyone. So the first email goes to the
 * owner's verified address when there is one, and greets them by name either
 * way. A guessed address is never used: guesses are research only (DECISIONS,
 * 14 Oct). Follow-ups go where the first email went, to the same person.
 */
export interface Owner {
  personId: string;
  name: string;
  title: string | null;
  seniority: Seniority;
  /** Verified, and on no list. Null when there is no address they can be written to. */
  email: string | null;
  /** "Jane" or "Dr. Smith"; null when the name is not one to greet safely. */
  greeting: string | null;
}

export interface Recipient {
  email: string | null;
  /** As `prospects.emailConfidence`: an owner's address was published on their site. */
  emailConfidence: string | null;
  /** Who the email greets and is recorded against; null for the business itself. */
  person: Owner | null;
}

/** The last email in a prospect's sequence: where a follow-up goes. */
export interface EarlierEmail {
  toAddress: string | null;
  personId: string | null;
}

const RANK: Record<Seniority, number> = { founder_owner: 0, c_level: 1, vp: 2, director: 3, other: 9 };
// Said no, or asked not to be written to: never an addressee.
const CLOSED = ["not_interested", "do_not_contact"];

const DOCTOR = /^(dr|doctor)\.?$/i;
const HONORIFIC = /^(mr|mrs|ms|miss|mx|sir|dame|atty|engr|eng|prof)\.?$/i;
const CREDENTIAL =
  /^(jr|sr|ii|iii|iv|phd|md|dds|dmd|do|od|dvm|bvsc|bdsc|dpm|dc|dpt|pt|pharmd|mds|fracds|rn|np|cpa|esq|mba|bds|mbbs|frcs|facs|cfp|jd|llb)\.?$/i;
// Particles that belong to the surname after them: "Dela Cruz", "Delos Santos",
// "De Los Santos", "San Pedro", "van der Berg". Common in Cebu and Austin alike.
const PARTICLE =
  /^(de|dela|delos|delas|del|della|der|den|los|las|san|santa|st\.?|al|el|van|von|di|da|dos|das|du|le|la|ten|ter|bin|binti)$/i;
// A capitalised word of two letters or more: not an initial, not a stray symbol.
const WORD = /^\p{Lu}[\p{L}'’-]+$/u;
// Opens with two capitals: an unknown credential ("BDSc", "FRACDS") or a
// surname in capitals, and either way not a word to put after "Dr.".
const SHOUTED = /^\p{Lu}{2}/u;
const tidy = (word: string) => (word === word.toUpperCase() ? word[0] + word.slice(1).toLowerCase() : word);

/**
 * How to open an email to someone: "Jane" for Jane Smith, "Dr. Dela Cruz" for
 * Dr. Maria Dela Cruz, DDS. Null when the name gives no safe answer (one word,
 * an initial, lower case, a surname that may be a credential), and the email
 * then greets the business as before: a wrong name in the first word is worse
 * than no name.
 */
export function greetingName(full: string): string | null {
  const words = full
    .replace(/\(.*?\)|".*?"/g, " ")
    .split(",")[0]
    .split(/\s+/)
    .filter(Boolean);
  const doctor = words.length > 0 && DOCTOR.test(words[0]);
  const rest = words.filter((w, i) => !(i === 0 && doctor) && !HONORIFIC.test(w) && !CREDENTIAL.test(w));
  if (doctor) {
    let i = rest.length - 1;
    const last = rest[i];
    if (!last || !WORD.test(last) || SHOUTED.test(last)) return null;
    // Walk back over particles. A given name is not one, so the walk stops
    // there; "Dr. De Souza", with no given name, keeps its whole surname.
    while (i > 0 && PARTICLE.test(rest[i - 1])) i--;
    return `Dr. ${rest.slice(i).join(" ")}`;
  }
  return rest.length >= 2 && WORD.test(rest[0]) ? tidy(rest[0]) : null;
}

/** The best person to write to: someone with a usable address first, then the most senior. */
export function bestOwner(rows: (Owner & { score: number | null })[]): Owner | null {
  const [top] = [...rows].sort(
    (a, b) =>
      Number(!!b.email) - Number(!!a.email) ||
      RANK[a.seniority] - RANK[b.seniority] ||
      (b.score ?? 0) - (a.score ?? 0) ||
      a.name.localeCompare(b.name),
  );
  if (!top) return null;
  const { score: _score, ...owner } = top;
  return owner;
}

/** The decision-maker to address for each prospect, from discovery. */
export async function ownersFor(prospectIds: string[], personId?: string): Promise<Map<string, Owner>> {
  if (prospectIds.length === 0) return new Map();
  const rows = await getDb()
    .select({
      prospectId: companies.originId,
      personId: people.id,
      name: people.name,
      title: people.title,
      seniority: people.seniority,
      email: people.email,
      emailStatus: people.emailStatus,
      score: people.score,
      // Asked not to be written to, or bounced: the address is not one to use.
      blocked: sql<boolean>`exists (select 1 from ${suppressions} where ${suppressions.kind} in ('email', 'bounced') and ${suppressions.value} = lower(${people.email}))`,
    })
    .from(people)
    .innerJoin(companies, eq(companies.id, people.companyId))
    .where(
      and(
        eq(companies.origin, "prospect"),
        inArray(companies.originId, prospectIds),
        notInArray(people.status, CLOSED),
        personId ? eq(people.id, personId) : undefined,
      ),
    );

  const byProspect = new Map<string, (Owner & { score: number | null })[]>();
  for (const r of rows) {
    if (!r.prospectId) continue;
    const usable = r.email && r.emailStatus === "verified" && !r.blocked ? r.email : null;
    const list = byProspect.get(r.prospectId) ?? [];
    list.push({
      personId: r.personId,
      name: r.name,
      title: r.title,
      seniority: r.seniority as Seniority,
      email: usable,
      greeting: greetingName(r.name),
      score: r.score,
    });
    byProspect.set(r.prospectId, list);
  }
  const owners = new Map<string, Owner>();
  for (const [id, list] of byProspect) {
    const owner = bestOwner(list);
    if (owner) owners.set(id, owner);
  }
  return owners;
}

/**
 * One chosen person at a prospect, as the addressee: the Copy email on a row
 * of /people. The same checks as `ownersFor` (their own business, not closed,
 * an address only when verified and on no list); null when they fail them.
 */
export async function ownerFor(prospectId: string, personId: string): Promise<Owner | null> {
  return (await ownersFor([prospectId], personId)).get(prospectId) ?? null;
}

/** The latest email of each prospect's sequence (drafts awaiting review excluded). */
export async function earlierEmailsFor(prospectIds: string[]): Promise<Map<string, EarlierEmail>> {
  if (prospectIds.length === 0) return new Map();
  const rows = await getDb()
    .select({ prospectId: outreach.prospectId, toAddress: outreach.toAddress, personId: outreach.personId })
    .from(outreach)
    .where(and(inArray(outreach.prospectId, prospectIds), eq(outreach.channel, "email"), gte(outreach.step, 0)))
    .orderBy(desc(outreach.step), desc(outreach.createdAt));
  const earlier = new Map<string, EarlierEmail>();
  for (const r of rows) {
    if (r.prospectId && !earlier.has(r.prospectId)) earlier.set(r.prospectId, { toAddress: r.toAddress, personId: r.personId });
  }
  return earlier;
}

/**
 * Where the next email goes. A follow-up goes where the sequence started —
 * rows from before 14 Oct record no address and went to the business. A first
 * email goes to the owner's verified address if there is one, otherwise to the
 * business, greeting the owner when one is known.
 */
export function pickRecipient(input: {
  business: { email: string | null; emailConfidence: string | null };
  owner: Owner | null;
  earlier: EarlierEmail | null;
}): Recipient {
  const { business, owner, earlier } = input;
  if (earlier) {
    const email = earlier.toAddress ?? business.email;
    const isBusiness = !earlier.toAddress || earlier.toAddress.toLowerCase() === business.email?.toLowerCase();
    return {
      email,
      emailConfidence: isBusiness ? business.emailConfidence : "mailto",
      person: owner && earlier.personId === owner.personId ? owner : null,
    };
  }
  if (owner?.email) return { email: owner.email, emailConfidence: "mailto", person: owner };
  return { email: business.email, emailConfidence: business.emailConfidence, person: owner };
}

/**
 * Swaps the business name in an email's opening for the person's: "Hi Bay
 * Dental," becomes "Hi Jane,". Only an exact opening is touched — "Hi Bay
 * Dental Studio" is a different business and is left alone — so a message
 * that opens some other way keeps its own words.
 */
export function addressTo(text: string, business: string, greeting: string | null | undefined): string {
  const opener = `Hi ${business.trim()}`;
  if (!greeting || !text.startsWith(opener)) return text;
  const rest = text.slice(opener.length);
  return /^(,|!|:|\n|\s+[—–-]\s)/.test(rest) ? `Hi ${greeting}${rest}` : text;
}

/**
 * Whether an address is on the do-not-contact list in its own right. The
 * prospect's own address, phone and domain are `findSuppression`'s; this is
 * for an owner's address, which a "do not contact" on /people puts there.
 */
export async function addressListed(email: string): Promise<{ reason: string | null } | null> {
  const [hit] = await getDb()
    .select({ reason: suppressions.reason })
    .from(suppressions)
    .where(and(eq(suppressions.kind, "email"), eq(suppressions.value, email.trim().toLowerCase())))
    .limit(1);
  return hit ?? null;
}

/** An email to them went out: /people moves them from New to Contacted, and no further. */
export async function markPersonContacted(personId: string | null | undefined, now: Date = new Date()): Promise<void> {
  if (!personId) return;
  await getDb()
    .update(people)
    .set({ status: "contacted", updatedAt: now })
    .where(and(eq(people.id, personId), eq(people.status, "new")));
}

/**
 * Whether the person a sequence started with has said no on /people. "Do not
 * contact" also lists their address; "Not interested" lists nothing, so the
 * status itself is the check.
 */
export async function personClosed(personId: string): Promise<string | null> {
  const [row] = await getDb().select({ status: people.status }).from(people).where(eq(people.id, personId)).limit(1);
  if (row?.status === "not_interested") return "they said they are not interested (Decision-makers)";
  if (row?.status === "do_not_contact") return "marked do not contact (Decision-makers)";
  return null;
}
