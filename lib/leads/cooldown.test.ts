import { describe, expect, it } from "vitest";
import { latestByCompany } from "./cooldown";

const jan = (d: number) => new Date(`2026-01-${String(d).padStart(2, "0")}T00:00:00Z`);

describe("latestByCompany", () => {
  it("ignores rows that were never sent", () => {
    // The whole point: a written draft must not silence a company.
    expect(latestByCompany([{ company: "Jawa.gg", at: null }]).size).toBe(0);
  });

  it("keeps the most recent send per company", () => {
    const map = latestByCompany([
      { company: "Atria", at: jan(3) },
      { company: "Atria", at: jan(9) },
      { company: "Atria", at: jan(5) },
    ]);
    expect(map.get("atria")).toEqual(jan(9));
  });

  it("matches companies case-insensitively", () => {
    const map = latestByCompany([{ company: "Jawa.GG", at: jan(2) }]);
    expect(map.get("jawa.gg")).toEqual(jan(2));
  });

  it("keeps companies apart", () => {
    const map = latestByCompany([
      { company: "Atria", at: jan(2) },
      { company: "Jawa.gg", at: jan(4) },
    ]);
    expect(map.size).toBe(2);
  });
});
