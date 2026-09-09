import { getAccessToken, readCredentials, type GmailCredentials } from "./client";

/**
 * Whether Gmail will actually accept a draft right now.
 *
 * Figma's settings screen (3:1572) has a Gmail card showing the connected
 * account and its state. The app had nothing: the only way to learn the refresh
 * token had expired was to run `pnpm gmail:drafts` and watch it fail, which
 * happens at the end of a daily run rather than the start.
 *
 * That matters here more than it would elsewhere. While the OAuth consent
 * screen is in Testing, Google expires the refresh token every seven days, so
 * this is a recurring chore rather than a one-off setup step, and the failure
 * is silent until the moment someone needs a draft written.
 *
 * The only honest way to answer the question is to ask Google, so this spends a
 * token refresh. Nothing else is called: a refresh proves the credential works
 * without touching the mailbox, and the app holds `gmail.compose` only, which
 * cannot read mail anyway.
 */
export type GmailState = "connected" | "expired" | "unconfigured" | "error";

export interface GmailStatus {
  state: GmailState;
  /** One line, in words that say what to do about it. */
  message: string;
}

export interface GmailStatusDeps {
  read: () => GmailCredentials;
  token: (creds: GmailCredentials) => Promise<string>;
}

const DEFAULTS: GmailStatusDeps = { read: readCredentials, token: getAccessToken };

export async function checkGmail(deps: GmailStatusDeps = DEFAULTS): Promise<GmailStatus> {
  let creds: GmailCredentials;
  try {
    creds = deps.read();
  } catch (err) {
    // Missing variables are not a fault to investigate — the app has simply
    // never been authorised on this machine.
    return { state: "unconfigured", message: messageOf(err) };
  }

  try {
    await deps.token(creds);
    return { state: "connected", message: "Gmail accepted the refresh token." };
  } catch (err) {
    const message = messageOf(err);
    // `explainTokenFailure` already turns invalid_grant into the sentence that
    // says which command fixes it, so this classifies rather than rewrites.
    const expired = /invalid_grant|expire/i.test(message);
    return { state: expired ? "expired" : "error", message };
  }
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
