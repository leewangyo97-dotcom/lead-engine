import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isBouncedIn } from "./bounce";
import { BOUNCED_REASON, chooseChannel, emailUnconfirmed, UNCONFIRMED_NOTE } from "./contact";

/**
 * "It bounced" and "unconfirmed" (14 Oct). Angurugu, Grace Podiatry and
 * Alyangula bounced in one morning, every address from the map listing.
 */
const place = {
  name: "Grace Podiatry",
  email: "info@podiatristperth.net.au",
  phoneE164: "+61412345678",
};

describe("a bounced address", () => {
  it("closes email and leaves the phone open", () => {
    const plan = chooseChannel({ ...place, emailBounced: true });
    expect(plan.email).toMatchObject({ available: false, reason: BOUNCED_REASON });
    expect(plan.whatsapp.available).toBe(true);
    expect(plan.preferred).toBe("whatsapp");
  });

  it("matches by address, whatever its case", () => {
    const set = new Set(["info@podiatristperth.net.au"]);
    expect(isBouncedIn(set, "Info@PodiatristPerth.net.au")).toBe(true);
    expect(isBouncedIn(set, "hello@podiatristperth.net.au")).toBe(false);
    expect(isBouncedIn(set, null)).toBe(false);
  });

  it("does not put the business on the do-not-contact list", () => {
    const log = readFileSync("lib/places/outreach-log.ts", "utf8");
    const find = log.slice(log.indexOf("export async function findSuppression("));
    expect(find.slice(0, 1500)).toContain("ne(suppressions.kind, BOUNCED)");
  });

  it("is refused on the email channel where every send passes", () => {
    const log = readFileSync("lib/places/outreach-log.ts", "utf8");
    const compose = log.slice(log.indexOf("export async function composeContact("));
    expect(compose).toMatch(/if \(channel === "email" && emailBounced\) return \{ ok: false, blocked: BOUNCED_REASON \}/);
  });

  it("is scored as no email at all, tonight as well as on the page", () => {
    expect(readFileSync("scripts/score-prospects.ts", "utf8")).toContain("emailBounced: isBouncedIn(bounced, row.email)");
    expect(readFileSync("lib/places/prospect-queries.ts", "utf8")).toContain(
      "scoreProspect({ ...r, siteSignals, emailBounced })",
    );
  });

  it("shows at once on the row, like a decline", () => {
    const ui = readFileSync("app/components/prospect-contact.tsx", "utf8");
    expect(ui).toContain("if (res.ok) setBouncedNow(bounced);");
    expect(ui).toContain("const emailOk = email.available && !isBounced;");
  });
});

describe("an unconfirmed address", () => {
  it("is one only the map listing holds", () => {
    expect(emailUnconfirmed({ email: "a@b.au", emailConfidence: "osm" })).toBe(true);
    expect(emailUnconfirmed({ email: "a@b.au", emailConfidence: null })).toBe(true);
    expect(emailUnconfirmed({ email: "a@b.au", emailConfidence: "mailto" })).toBe(false);
    expect(emailUnconfirmed({ email: "a@b.au", emailConfidence: "text" })).toBe(false);
    expect(emailUnconfirmed({ email: null, emailConfidence: "osm" })).toBe(false);
  });

  it("stays usable, with the warning said where the button is", () => {
    const plan = chooseChannel({ ...place, emailConfidence: "osm" });
    expect(plan.email).toMatchObject({ available: true, note: UNCONFIRMED_NOTE });
    expect(chooseChannel({ ...place, emailConfidence: "mailto" }).email.note).toBeUndefined();
  });
});
