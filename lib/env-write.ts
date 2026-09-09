import { existsSync, readFileSync, writeFileSync } from "node:fs";

/**
 * Writes one variable into `.env.local`, in place.
 *
 * The Gmail token has to be replaced every seven days while the consent screen
 * is in Testing, and the auth script used to print the line and trust a human to
 * paste it. That failed the first time it mattered: the token was generated, the
 * paste never happened, and the Gmail path stayed broken for a week while
 * everything reported success. A weekly chore has to be one step, not two.
 *
 * Other lines are preserved exactly, comments included — this file holds every
 * local secret and is not something to rewrite wholesale.
 */
export function setLocalEnv(key: string, value: string, path = ".env.local"): "updated" | "added" {
  const line = `${key}="${value}"`;
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";

  // Anchored to the start of a line so a commented-out entry is left alone and
  // a key that merely contains this one's name is not mistaken for it.
  const pattern = new RegExp(`^${key}\s*=.*$`, "m");

  if (pattern.test(existing)) {
    writeFileSync(path, existing.replace(pattern, line));
    return "updated";
  }

  const separator = existing.length === 0 || existing.endsWith("\n") ? "" : "\n";
  writeFileSync(path, `${existing}${separator}${line}\n`);
  return "added";
}
