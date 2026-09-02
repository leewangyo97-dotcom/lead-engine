import { describe, expect, it } from "vitest";
import { isAnsweredProspectStatus } from "./followup-queries";

describe("isAnsweredProspectStatus", () => {
  it("treats a reply or a closed outcome as answered", () => {
    for (const s of ["replied", "won", "lost"]) expect(isAnsweredProspectStatus(s)).toBe(true);
  });

  it("treats do-not-contact as answered, so the ladder stops", () => {
    // Following up on someone who asked not to be contacted is worse than
    // never contacting them at all.
    expect(isAnsweredProspectStatus("do_not_contact")).toBe(true);
  });

  it("leaves a contacted prospect on the ladder", () => {
    expect(isAnsweredProspectStatus("contacted")).toBe(false);
    expect(isAnsweredProspectStatus("new")).toBe(false);
  });
});
