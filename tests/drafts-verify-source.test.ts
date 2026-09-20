import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * A draft that cites a Lighthouse measurement must not be reported as confirmed.
 *
 * `verify-drafts` settles claims by fetching the page. Three of the things a
 * draft can now say — a homepage's weight in megabytes, a count of elements
 * failing contrast, images with no dimensions — cannot be settled that way: the
 * weight is mostly subresources this project never downloads, and contrast
 * needs the page rendered.
 *
 * Before they were named as claims at all, such a draft carried no kind and was
 * reported as *making no claim a fetch could settle* — the same false comfort
 * `no-claims` exists to prevent, one level up. Naming them without this branch
 * is worse still: they would fall through the loop as `ok` and be counted among
 * the "claim(s) checked and true", having been checked by nothing.
 */
const SOURCE = readFileSync("scripts/verify-drafts.ts", "utf8");

describe("drafts:verify and measured claims", () => {
  it("downgrades a measured claim to unverifiable", () => {
    const from = SOURCE.indexOf("measuredClaims(claims)");
    expect(from).toBeGreaterThan(-1);
    const block = SOURCE.slice(from, from + 600);
    expect(block).toMatch(/verdict = "unverifiable"/);
  });

  it("never lets a measured claim be counted as confirmed", () => {
    const from = SOURCE.indexOf("measuredClaims(claims)");
    const block = SOURCE.slice(from, from + 600);
    expect(block).not.toMatch(/verdict = "ok"/);
  });

  it("says how to settle it, naming the prospect", () => {
    expect(SOURCE).toMatch(/pnpm lh \$\{row\.id\}/);
  });

  it("does not fetch for them — a fetch cannot disagree, so it would print ok", () => {
    // The fetch is gated on `needsFetch`, which excludes every measured kind.
    // If this ever becomes `claims.length` the script pulls down every site and
    // confirms nothing.
    expect(SOURCE).toMatch(/if \(row\.website && needsFetch\(claims\)\)/);
  });
});
