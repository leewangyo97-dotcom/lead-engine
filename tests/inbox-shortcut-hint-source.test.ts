import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The inbox only advertises keyboard shortcuts when they exist.
 *
 * The shortcuts live in InboxList, which is not mounted for an empty list. The
 * "Navigate J K" legend and the "Press Enter to open the selected lead · ? for
 * all shortcuts" line were rendered regardless, so on 24 Sept — nothing left to
 * triage — the page offered three keys that did nothing and a selected lead
 * that did not exist.
 */
const SOURCE = readFileSync("app/page.tsx", "utf8");

describe("inbox shortcut hints", () => {
  for (const marker of ["Navigate", "for all shortcuts"]) {
    it(`renders "${marker}" only when there are rows`, () => {
      const at = SOURCE.indexOf(marker);
      expect(at).toBeGreaterThan(-1);
      const gate = SOURCE.lastIndexOf("rows.length > 0 && (", at);
      expect(gate).toBeGreaterThan(-1);
      // The gate must be the nearest block opener, not one further up the file.
      expect(SOURCE.slice(gate, at)).not.toMatch(/\n\s*\)\}\n/);
    });
  }
});
