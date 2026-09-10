import { describe, expect, it } from "vitest";
import { keyOf, releasable, type Identifier } from "./undecline";

const phone = (value: string): Identifier => ({ kind: "phone", value });
const email = (value: string): Identifier => ({ kind: "email", value });
const domain = (value: string): Identifier => ({ kind: "domain", value });

describe("releasable", () => {
  it("gives everything back when nobody else is declined", () => {
    const mine = [email("hi@clinic.com.au"), phone("+61356292067")];
    expect(releasable(mine, [])).toEqual(mine);
  });

  it("keeps a number another declined business also answers on", () => {
    // The council switchboard: twelve preschools, one line. Undoing one must not
    // un-suppress the eleven that said no.
    const mine = [phone("+61356292067"), email("one@preschool.vic.edu.au")];
    const others = [phone("+61356292067")];
    expect(releasable(mine, others)).toEqual([email("one@preschool.vic.edu.au")]);
  });

  it("matches regardless of case, because the list is written lowercased", () => {
    expect(releasable([email("Hi@Clinic.com")], [email("hi@clinic.com")])).toEqual([]);
  });

  it("does not confuse a phone with a domain that reads the same", () => {
    // The key carries the kind, so these are two different entries.
    expect(releasable([phone("12345678")], [domain("12345678")])).toEqual([phone("12345678")]);
  });

  it("releases a value once when the prospect lists it twice", () => {
    // phone and whatsapp are usually the same line.
    const mine = [phone("+639171234567"), phone("+639171234567")];
    expect(releasable(mine, [])).toEqual([phone("+639171234567")]);
  });

  it("keeps everything when every identifier is shared", () => {
    const mine = [phone("+61 1"), email("a@b.com")];
    expect(releasable(mine, [phone("+61 1"), email("a@b.com")])).toEqual([]);
  });

  it("is empty for a prospect with no identifiers at all", () => {
    expect(releasable([], [phone("+61 1")])).toEqual([]);
  });
});

describe("keyOf", () => {
  it("joins kind and value so the two namespaces cannot collide", () => {
    expect(keyOf(phone("+61 1"))).toBe("phone:+61 1");
    expect(keyOf(domain("+61 1"))).toBe("domain:+61 1");
  });

  it("lowercases the value", () => {
    expect(keyOf(email("HI@Clinic.COM"))).toBe("email:hi@clinic.com");
  });
});
