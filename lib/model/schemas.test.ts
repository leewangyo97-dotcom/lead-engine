import { describe, expect, it } from "vitest";
import { DraftBatch, ScoreBatch, VerdictBatch } from "./schemas";
import { buildMime } from "../gmail/client";

describe("model output contract", () => {
  it("accepts a well-formed score batch", () => {
    const ok = ScoreBatch.safeParse({
      scores: [{ id: "abc", score: 82, tier: "live", reason: "Kotlin, contract, 8h overlap" }],
    });
    expect(ok.success).toBe(true);
  });

  it("rejects a score outside 0-100 and a reason over 120 chars", () => {
    expect(
      ScoreBatch.safeParse({ scores: [{ id: "a", score: 120, tier: "live", reason: "x" }] }).success,
    ).toBe(false);
    expect(
      ScoreBatch.safeParse({
        scores: [{ id: "a", score: 80, tier: "live", reason: "x".repeat(121) }],
      }).success,
    ).toBe(false);
  });

  it("requires every draft to name the proof points it used", () => {
    const withoutProof = DraftBatch.safeParse({
      drafts: [{ leadId: "a", subject: "s", body: "b", angle: "mobile", proofUsed: [] }],
    });
    // A draft that cannot say what it leaned on is either unfounded or
    // unauditable, and the verifier has nothing to check it against.
    expect(withoutProof.success).toBe(false);
  });

  it("rejects a verdict that passes while carrying violations", () => {
    const incoherent = VerdictBatch.safeParse({
      verdicts: [{ leadId: "a", ok: true, violations: ["claims a client not in PROFILE.md"] }],
    });
    expect(incoherent.success).toBe(false);

    const coherent = VerdictBatch.safeParse({
      verdicts: [{ leadId: "a", ok: false, violations: ["claims a client not in PROFILE.md"] }],
    });
    expect(coherent.success).toBe(true);
  });

  it("rejects an empty batch rather than treating it as a no-op", () => {
    expect(ScoreBatch.safeParse({ scores: [] }).success).toBe(false);
    expect(DraftBatch.safeParse({ drafts: [] }).success).toBe(false);
  });
});

describe("gmail mime", () => {
  it("round-trips an ASCII message", () => {
    const raw = buildMime({ to: "dave@example.com", subject: "hello", body: "line one" });
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    expect(decoded).toContain("To: dave@example.com");
    expect(decoded).toContain("Subject: hello");
    expect(decoded).toContain("line one");
  });

  it("encodes a non-ASCII subject instead of mangling it", () => {
    const raw = buildMime({ to: "a@b.co", subject: "café — available", body: "x" });
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    expect(decoded).toContain("Subject: =?UTF-8?B?");
    expect(decoded).not.toContain("Subject: café");
  });

  it("uses CRLF line endings, as RFC 2822 requires", () => {
    const raw = buildMime({ to: "a@b.co", subject: "s", body: "x" });
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    expect(decoded).toContain("\r\n");
  });
});
