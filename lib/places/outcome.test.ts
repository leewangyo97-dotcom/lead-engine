import { describe, expect, it } from "vitest";
import { PROSPECT_OUTCOMES, isAnswered, isProspectOutcome } from "./outcome";

describe("isProspectOutcome", () => {
  it("accepts the four verbs and nothing else", () => {
    for (const v of ["replied", "won", "lost", "reopen"]) expect(isProspectOutcome(v)).toBe(true);
    for (const v of ["maybe", "contacted", "", null, 7]) expect(isProspectOutcome(v)).toBe(false);
  });

  it("maps reopen back to contacted, so an outcome can be taken back", () => {
    expect(PROSPECT_OUTCOMES.reopen).toBe("contacted");
  });
});

describe("isAnswered", () => {
  it("counts won and lost as answers, not just a reply", () => {
    // Both mean the message got a response, which is what the follow-up ladder
    // and the weekly review are actually asking.
    for (const s of ["replied", "won", "lost"]) expect(isAnswered(s)).toBe(true);
  });

  it("leaves a contacted prospect unanswered", () => {
    for (const s of ["new", "contacted", "queued"]) expect(isAnswered(s)).toBe(false);
  });
});
