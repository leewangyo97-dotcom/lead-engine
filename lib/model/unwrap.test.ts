import { describe, expect, it } from "vitest";
import { unwrapClaudeResult } from "./unwrap";

const envelope = (result: unknown, extra: object = {}) =>
  JSON.stringify({ type: "result", subtype: "success", is_error: false, result, ...extra });

const BATCH = '{"enhanced":[{"prospectId":"p1","message":"Hi","angle":"a","usedSignals":["no_website"]}]}';

describe("unwrapClaudeResult", () => {
  it("returns the model's JSON as written", () => {
    expect(unwrapClaudeResult(envelope(BATCH))).toBe(BATCH);
  });

  it("takes it out of a ```json fence", () => {
    expect(unwrapClaudeResult(envelope("```json\n" + BATCH + "\n```"))).toBe(BATCH);
  });

  it("drops a sentence the model put before it", () => {
    expect(unwrapClaudeResult(envelope(`Here it is:\n${BATCH}`))).toBe(BATCH);
  });

  it("fails loudly when Claude Code reports an error, saying what it said", () => {
    const failed = envelope("Invalid API key · Please run /login", { is_error: true, subtype: "error" });
    expect(() => unwrapClaudeResult(failed)).toThrow(/reported an error \(error\): Invalid API key/);
  });

  it("fails when the envelope is not JSON at all", () => {
    expect(() => unwrapClaudeResult("Usage: claude [options]")).toThrow(/not JSON/);
  });
});
