import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The auth script must write the refresh token, never print it.
 *
 * It printed the token for a week. That cost two things: a run where the token
 * was generated and never pasted, so the Gmail path stayed broken while
 * everything else reported success — and a live credential sitting in terminal
 * scrollback, which is one screenshot or one paste away from being shared. It
 * was in fact pasted into a chat.
 *
 * A source-level check, because the failure is a line of code rather than a
 * behaviour a unit test can reach without walking Google's OAuth flow.
 */
const source = readFileSync("scripts/gmail-auth.ts", "utf8");

describe("gmail:auth", () => {
  it("never prints the refresh token", () => {
    const printsToken = /console\.(log|error|info)\([^)]*refresh_token/.test(source);
    expect(printsToken).toBe(false);
  });

  it("writes it to .env.local instead", () => {
    expect(source).toMatch(/setLocalEnv\(\s*"GOOGLE_REFRESH_TOKEN"/);
  });

  it("says the token expires, since that is the whole trap", () => {
    expect(source).toMatch(/seven days/);
  });
});
