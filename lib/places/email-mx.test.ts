import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { chooseChannel } from "./contact";
import { checkMailDomain, emailDomainDead, type Resolver } from "./email-mx";
import { scoreProspect } from "./score";

const fail = (code: string) => Promise.reject(Object.assign(new Error(code), { code }));

/** A resolver that answers from a table; anything absent has no records. */
function resolver(table: { mx?: string[] | string; a?: string[] | string; aaaa?: string[] | string }): Resolver {
  const answer = (v: string[] | string | undefined) => (typeof v === "string" ? fail(v) : Promise.resolve(v ?? []));
  return {
    resolveMx: () =>
      typeof table.mx === "string" ? fail(table.mx) : Promise.resolve((table.mx ?? []).map((exchange) => ({ exchange, priority: 10 }))),
    resolve4: () => (table.a === undefined ? fail("ENODATA") : answer(table.a)),
    resolve6: () => (table.aaaa === undefined ? fail("ENODATA") : answer(table.aaaa)),
  };
}

describe("checkMailDomain", () => {
  it("takes mail when there is an MX record", async () => {
    expect(await checkMailDomain("bay.com", resolver({ mx: ["mx.bay.com"] }))).toBe("ok");
  });

  it("is dead when the domain does not exist", async () => {
    expect(await checkMailDomain("welovetreestx.xom", resolver({ mx: "ENOTFOUND" }))).toBe("dead");
  });

  it("is dead on a null MX, the domain's own word that it takes no mail", async () => {
    expect(await checkMailDomain("nomail.com", resolver({ mx: [""] }))).toBe("dead");
  });

  it("falls back to the domain's address when there is no MX (RFC 5321)", async () => {
    expect(await checkMailDomain("old.com", resolver({ mx: "ENODATA", a: ["192.0.2.1"] }))).toBe("ok");
    expect(await checkMailDomain("v6.com", resolver({ mx: "ENODATA", aaaa: ["2001:db8::1"] }))).toBe("ok");
  });

  it("is dead with no MX and no address at all", async () => {
    expect(await checkMailDomain("parked.com", resolver({ mx: "ENODATA" }))).toBe("dead");
  });

  it("says unknown, never dead, when DNS itself fails", async () => {
    expect(await checkMailDomain("slow.com", resolver({ mx: "ETIMEOUT" }))).toBe("unknown");
    expect(await checkMailDomain("odd.com", resolver({ mx: "ENODATA", a: "ESERVFAIL" }))).toBe("unknown");
  });
});

describe("a domain with no mail server", () => {
  const check = { domain: "deadclinic.com", mx: false, at: "2026-10-15T00:00:00Z" };
  const place = {
    name: "Dead Clinic",
    category: "clinics",
    email: "info@deadclinic.com",
    emailConfidence: null,
    emailCheck: check,
    phoneE164: null,
    whatsappE164: null,
    countryCode: "AU",
    status: "new",
  };

  it("counts only for the address it was checked for", () => {
    expect(emailDomainDead(place)).toBe(true);
    expect(emailDomainDead({ ...place, email: "info@newclinic.com" })).toBe(false);
    expect(emailDomainDead({ ...place, emailCheck: { ...check, mx: true } })).toBe(false);
    expect(emailDomainDead({ ...place, emailCheck: null })).toBe(false);
  });

  it("is not offered as an email channel", () => {
    const plan = chooseChannel(place);
    expect(plan.email.available).toBe(false);
    expect(plan.email.reason).toContain("no mail server");
  });

  it("scores as no email", () => {
    const dead = scoreProspect({ ...place, siteSignals: null });
    const alive = scoreProspect({ ...place, emailCheck: { ...check, mx: true }, siteSignals: null });
    expect(alive.score).toBeGreaterThan(dead.score);
  });
});

describe("the nightly run", () => {
  it("checks new addresses before it scores, so scores know tonight", () => {
    const nightly = readFileSync(".github/workflows/nightly.yml", "utf8");
    expect(nightly.indexOf("pnpm email:mx")).toBeGreaterThan(-1);
    expect(nightly.indexOf("pnpm email:mx")).toBeLessThan(nightly.indexOf("pnpm prospects:score"));
  });
});
