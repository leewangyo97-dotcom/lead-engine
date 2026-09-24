import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The Gmail scripts fail with exit code 1, not a native crash.
 *
 * Both hit the same thing on Windows with the refresh token dead: the advice
 * printed, then "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)" and
 * exit 3221226505 — `process.exit()` tearing down the rejected token request's
 * socket mid-close. `gmail:smoke` was fixed on 20 Sept and `gmail:drafts` still
 * crashed on 24 Sept, because nothing pinned the pattern. This does.
 */
describe.each(["scripts/gmail-smoke.ts", "scripts/create-gmail-drafts.ts"])("%s", (path) => {
  const source = readFileSync(path, "utf8");

  it("sets exitCode in its failure handler instead of calling exit()", () => {
    const from = source.lastIndexOf(".catch(");
    expect(from).toBeGreaterThan(-1);
    const handler = source.slice(from);
    expect(handler).toMatch(/process\.exitCode = 1/);
    // A call, not a mention: the smoke script's own comment explains why it
    // avoids `process.exit()`, and prose is not a call site.
    expect(handler).not.toMatch(/^\s*process\.exit\(/m);
  });
});
