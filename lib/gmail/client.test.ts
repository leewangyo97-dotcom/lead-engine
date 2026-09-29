import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearTokenCache, credentialAdvice, explainTokenFailure, getAccessToken } from "./client";

describe("explainTokenFailure", () => {
  it("explains the expiry that will actually happen", () => {
    // Testing-mode refresh tokens last seven days. This is the message someone
    // reads when the nightly Gmail step fails and they have no idea why.
    const message = explainTokenFailure(400, '{"error":"invalid_grant"}');
    expect(message).toMatch(/seven days/);
    expect(message).toMatch(/pnpm gmail:auth/);
    // No GitHub secret holds this token — only DATABASE_URL is stored there, and
    // the nightly workflow has no Gmail step. Sending someone to update a secret
    // that does not exist is worse than saying nothing.
    expect(message).not.toMatch(/GitHub secret/);
    expect(message).toMatch(/writes the new token/);
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

describe("credentialAdvice", () => {
  const ALL = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"];

  // The deployed app on 24 Sept: all three absent, and the advice sent the
  // reader to a command that writes a file the deployment never reads.
  it("on Vercel, points at the deployment's variables, not a local command", () => {
    const advice = credentialAdvice(ALL, true);
    expect(advice).toMatch(/environment variables in Vercel/);
    expect(advice).toMatch(/redeploy/);
    expect(advice).toMatch(/only writes \.env\.local/);
  });

  it("locally, asks for the client id and secret before gmail:auth, which needs them", () => {
    expect(credentialAdvice(ALL, false)).toMatch(/^set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET/);
  });

  it("locally, with only the token missing, gmail:auth alone is right", () => {
    expect(credentialAdvice(["GOOGLE_REFRESH_TOKEN"], false)).toBe("run pnpm gmail:auth");
  });
});

describe("getAccessToken's cache", () => {
  const creds = { clientId: "c", clientSecret: "s", refreshToken: "r1" };
  let calls = 0;
  const ok = () =>
    ({ ok: true, json: async () => ({ access_token: `tok${++calls}`, expires_in: 3600 }) }) as Response;

  beforeEach(() => {
    calls = 0;
    clearTokenCache();
    vi.stubGlobal("fetch", vi.fn(async () => ok()));
  });
  afterEach(() => vi.unstubAllGlobals());

  // Every Email click used to pay a round trip to Google first, for a token
  // that lives an hour.
  it("reuses a live token instead of asking Google again", async () => {
    expect(await getAccessToken(creds)).toBe("tok1");
    expect(await getAccessToken(creds)).toBe("tok1");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("asks again when told to — /settings wants a live answer", async () => {
    await getAccessToken(creds);
    expect(await getAccessToken(creds, { fresh: true })).toBe("tok2");
  });

  it("never serves a token from a previous refresh token", async () => {
    await getAccessToken(creds);
    expect(await getAccessToken({ ...creds, refreshToken: "r2" })).toBe("tok2");
  });

  it("asks again once the token is near its expiry", async () => {
    const t0 = 1_000_000;
    await getAccessToken(creds, { now: () => t0 });
    expect(await getAccessToken(creds, { now: () => t0 + 3_599_000 })).toBe("tok2");
  });

  it("does not remember a failed exchange", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 400, text: async () => '{"error":"invalid_grant"}' }) as Response));
    await expect(getAccessToken(creds)).rejects.toThrow();
    vi.stubGlobal("fetch", vi.fn(async () => ok()));
    expect(await getAccessToken(creds)).toBe("tok1");
  });
});
