import { describe, expect, it } from "vitest";
import { explainTokenFailure } from "./client";
import { checkGmail, type GmailStatusDeps } from "./status";

const creds = { clientId: "id", clientSecret: "secret", refreshToken: "token" };

const deps = (over: Partial<GmailStatusDeps>): GmailStatusDeps => ({
  read: () => creds,
  token: async () => "access-token",
  ...over,
});

describe("checkGmail", () => {
  it("is connected when the refresh is accepted", async () => {
    expect(await checkGmail(deps({}))).toEqual({
      state: "connected",
      message: "Gmail accepted the refresh token.",
    });
  });

  it("is unconfigured, not broken, when the variables are absent", async () => {
    const status = await checkGmail(
      deps({
        read: () => {
          throw new Error("missing Gmail credentials: GOOGLE_REFRESH_TOKEN — run pnpm gmail:auth");
        },
      }),
    );
    expect(status.state).toBe("unconfigured");
    expect(status.message).toMatch(/gmail:auth/);
  });

  it("reads the seven-day expiry as expired, and keeps the advice", async () => {
    // The real path: Google rejects the token a week after it was issued while
    // the consent screen is in Testing.
    const status = await checkGmail(
      deps({
        token: async () => {
          throw new Error(explainTokenFailure(400, '{"error":"invalid_grant"}'));
        },
      }),
    );
    expect(status.state).toBe("expired");
    expect(status.message).toMatch(/pnpm gmail:auth/);
    // The card must not send anyone to a GitHub secret that does not exist.
    expect(status.message).not.toMatch(/GitHub/i);
  });

  it("keeps anything else as an error rather than guessing", async () => {
    const status = await checkGmail(
      deps({
        token: async () => {
          throw new Error("token refresh failed: 503 backend error");
        },
      }),
    );
    expect(status.state).toBe("error");
    expect(status.message).toMatch(/503/);
  });
});
