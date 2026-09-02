import { describe, expect, it } from "vitest";
import { explainTokenFailure } from "./client";

describe("explainTokenFailure", () => {
  it("explains the expiry that will actually happen", () => {
    // Testing-mode refresh tokens last seven days. This is the message someone
    // reads when the nightly Gmail step fails and they have no idea why.
    const message = explainTokenFailure(400, '{"error":"invalid_grant"}');
    expect(message).toMatch(/seven days/);
    expect(message).toMatch(/pnpm gmail:auth/);
    expect(message).toMatch(/GitHub secret/);
  });

  it("distinguishes wrong credentials from an expired grant", () => {
    const message = explainTokenFailure(401, '{"error":"invalid_client"}');
    expect(message).toMatch(/GOOGLE_CLIENT_ID/);
    expect(message).not.toMatch(/seven days/);
  });

  it("passes an unrecognised failure through rather than guessing", () => {
    expect(explainTokenFailure(503, "upstream unavailable")).toContain("503");
    expect(explainTokenFailure(503, "upstream unavailable")).toContain("upstream unavailable");
  });

  it("repeats no secret back", () => {
    // The body of a failed exchange carries an error code, not a credential —
    // but the message is printed into CI logs, so this is worth pinning.
    const message = explainTokenFailure(400, '{"error":"invalid_grant"}');
    expect(message).not.toMatch(/client_secret|refresh_token=/);
  });
});
