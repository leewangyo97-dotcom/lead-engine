import { writeFileSync } from "node:fs";
import { eq, inArray, like } from "drizzle-orm";
import { loadLocalEnv } from "../lib/env";

/**
 * Exercises owner addressing (lib/places/recipient.ts) through the real code:
 * composeContact, recordCopiedEmail, logContact for WhatsApp, the row query.
 * Unit tests pin the rules; this checks what actually ships, end to end.
 *
 * Run against a scratch Neon branch, never production:
 *
 *   neon branches create --name owners --project-id <id>
 *   INTEGRATION_DATABASE_URL=$(neon connection-string owners ...) pnpm test:owners
 *   neon branches delete owners --project-id <id>
 *
 * It inserts its own prospects, companies and people, removes them when done,
 * and never creates a Gmail draft. `--samples=<file>` writes the composed
 * emails out for the verifier.
 */
loadLocalEnv();
const url = process.env.INTEGRATION_DATABASE_URL;
const productionUrl = process.env.DATABASE_URL;

let failures = 0;
function check(label: string, condition: boolean, detail = "") {
  console.log(`${condition ? "  ok  " : " FAIL "} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failures += 1;
}

async function main() {
  if (!url) {
    console.error("INTEGRATION_DATABASE_URL is not set. Refusing to run — see the header comment.");
    process.exit(1);
  }
  if (productionUrl && url === productionUrl) {
    console.error("refusing: INTEGRATION_DATABASE_URL is the same database as DATABASE_URL");
    process.exit(1);
  }
  // Everything below reads DATABASE_URL lazily, so it now points at the branch.
  process.env.DATABASE_URL = url;
  // No Gmail draft may be created from here, whatever .env.local holds.
  process.env.GOOGLE_REFRESH_TOKEN = "";

  const { getDb } = await import("../lib/db");
  const { companies, people, prospects, searches, suppressions } = await import("../lib/db/schema");
  const { composeContact, logContact, recordCopiedEmail } = await import("../lib/places/outreach-log");
  const { getProspect } = await import("../lib/places/prospect-queries");

  const db = getDb();
  const PREFIX = "owner-check:";
  const later = () => new Date(Date.now() + 6 * 86_400_000);
  const samples: string[] = [];
  const sample = (label: string, c: { place: { email: string | null }; subject: string; body: string }) =>
    samples.push(`=== ${label}\nTo: ${c.place.email}\nSubject: ${c.subject}\n\n${c.body}\n`);

  const [search] = await db.select({ id: searches.id }).from(searches).limit(1);
  if (!search) throw new Error("the branch has no searches to hang fixtures on");

  const prospect = async (n: number, over: Partial<typeof prospects.$inferInsert>) => {
    const [row] = await db
      .insert(prospects)
      .values({
        searchId: search.id,
        sourceId: `${PREFIX}${n}`,
        sourceProvider: "test",
        name: `Owner Check ${n}`,
        normalizedName: `owner check ${n}`,
        category: "dentists",
        city: "Austin",
        countryCode: "US",
        website: `https://owner-check-${n}.lead-engine-fixture.com`,
        email: `info@owner-check-${n}.lead-engine-fixture.com`,
        emailConfidence: "mailto",
        ...over,
      })
      .returning();
    return row;
  };
  const owner = async (prospectId: string, over: Partial<typeof people.$inferInsert>) => {
    const [company] = await db
      .insert(companies)
      .values({ name: "fixture", origin: "prospect", originId: prospectId })
      .returning();
    const [person] = await db
      .insert(people)
      .values({ companyId: company.id, name: "Dr. Maria Delos Santos", title: "Principal Dentist", seniority: "founder_owner", ...over })
      .returning();
    return person;
  };

  try {
    // A. An owner who published her own address.
    const a = await prospect(1, { name: "Joe's" });
    const maria = await owner(a.id, { email: "maria@owner-check-1.lead-engine-fixture.com", emailStatus: "verified" });
    const row = await getProspect(a.id);
    check("the row names the owner and says the email goes to her", row?.owner?.emailed === true, JSON.stringify(row?.owner));
    const first = await composeContact(a.id, "email");
    check(
      "a first email goes to her own address, and can be sent",
      first.ok && first.option.available && first.place.email === "maria@owner-check-1.lead-engine-fixture.com",
    );
    check("and greets her, particle kept", first.ok && first.body.startsWith("Hi Dr. Delos Santos,"));
    check("an already possessive name is not doubled", first.ok && first.subject.includes("Joe's website"), first.ok ? first.subject : "");
    if (first.ok) sample("A1 first email, owner's own address", first);
    const copied = await recordCopiedEmail(a.id);
    const [afterSend] = await db.select({ status: people.status }).from(people).where(eq(people.id, maria.id));
    check(
      "the send is recorded and moves her to Contacted",
      copied.ok && afterSend.status === "contacted",
      `${JSON.stringify(copied)} | ${afterSend.status}`,
    );
    const follow = await composeContact(a.id, "email", later);
    check("the follow-up goes to her, as step 1", follow.ok && follow.step === 1 && follow.place.email === "maria@owner-check-1.lead-engine-fixture.com");
    check("and greets her", follow.ok && follow.body.startsWith("Hi Dr. Delos Santos —"));
    if (follow.ok) sample("A2 follow-up 1, same owner", follow);
    await db.update(people).set({ status: "not_interested" }).where(eq(people.id, maria.id));
    const refused = await composeContact(a.id, "email", later);
    check("Not interested on /people stops the follow-up", !refused.ok && /not interested/.test(refused.blocked), refused.ok ? "" : refused.blocked);
    await db.delete(people).where(eq(people.id, maria.id));
    const erased = await composeContact(a.id, "email", later);
    check("a deleted person's address gets no more email", !erased.ok && /no longer on file/.test(erased.blocked), erased.ok ? "" : erased.blocked);

    // B. An owner with no address of his own: the business, greeting him.
    const b = await prospect(2, {});
    await owner(b.id, { name: "Matt Sanders", title: "Owner", email: null, emailStatus: "unknown" });
    const matt = await composeContact(b.id, "email");
    check(
      "no own address: to the business, greeting the owner",
      matt.ok && matt.option.available && matt.place.email === "info@owner-check-2.lead-engine-fixture.com" && matt.body.startsWith("Hi Matt,"),
    );
    if (matt.ok) sample("B first email, business address, greeting the owner", matt);

    // C. No website on record: nobody named.
    const c = await prospect(3, { website: null });
    await owner(c.id, { name: "Matt Sanders", email: "matt@owner-check-3.lead-engine-fixture.com", emailStatus: "verified" });
    const plain = await composeContact(c.id, "email");
    check("no website: business address and business greeting", plain.ok && plain.place.email === "info@owner-check-3.lead-engine-fixture.com" && plain.body.startsWith("Hi Owner Check 3,"));

    // D. A sequence begun on WhatsApp stays with the business.
    const d = await prospect(4, { whatsappE164: "+15125550123" });
    await owner(d.id, { email: "maria@owner-check-4.lead-engine-fixture.com", emailStatus: "verified" });
    const wa = await logContact(d.id, "whatsapp");
    const afterWa = await composeContact(d.id, "email", later);
    check(
      "after WhatsApp, the email follow-up goes to the business, greeting the business",
      wa.ok && afterWa.ok && afterWa.place.email === "info@owner-check-4.lead-engine-fixture.com" && afterWa.body.startsWith("Hi Owner Check 4 —"),
      afterWa.ok ? `${afterWa.place.email} | ${afterWa.body.split("\n")[0].slice(0, 40)}` : afterWa.blocked,
    );

    // E. A mistyped address is refused before anything is written.
    const e = await prospect(5, { email: "info@owner-check-5.xom" });
    const typo = await composeContact(e.id, "email");
    const typoCopy = await recordCopiedEmail(e.id);
    check("a mistyped address is not offered", typo.ok && !typo.option.available && /mistyped/.test(typo.option.reason ?? ""));
    check("and cannot be recorded as sent", !typoCopy.ok);
  } finally {
    const ids = (await db.select({ id: prospects.id }).from(prospects).where(like(prospects.sourceId, `${PREFIX}%`))).map((r) => r.id);
    if (ids.length) {
      await db.delete(companies).where(inArray(companies.originId, ids));
      await db.delete(prospects).where(inArray(prospects.id, ids));
    }
    await db.delete(suppressions).where(like(suppressions.value, "%owner-check-%"));
  }

  const out = process.argv.find((a) => a.startsWith("--samples="))?.slice("--samples=".length);
  if (out) writeFileSync(out, samples.join("\n"));
  console.log(failures === 0 ? "owner-check: all passed" : `owner-check: ${failures} failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
