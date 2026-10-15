import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { sql } from "drizzle-orm";
import { getDb } from "../lib/db";
import { loadLocalEnv } from "../lib/env";
import { REPO } from "../lib/github/dispatch";
import { checkGmail } from "../lib/gmail/status";
import { workingResolver } from "../lib/places/email-mx";
import { promises as dns } from "node:dns";

/**
 * Every piece of setup the app can use, checked, with the command that fixes
 * each gap:
 *
 *   pnpm setup:check
 *
 * The setup list had lived in a chat table for days: which token went where,
 * and which ones were done, was nowhere a command could answer. Values are
 * never printed, only whether they exist and work. The deployed site is not
 * checked from here: its Inbox card says what is missing on it.
 */
const run = promisify(execFile);

export interface Finding {
  ok: boolean;
  /** Required items fail the command; the rest are features that wait. */
  required?: boolean;
  what: string;
  /** What to do about it, when not ok. */
  fix?: string;
}

async function githubSecrets(): Promise<Set<string> | null> {
  try {
    const { stdout } = await run("gh", ["secret", "list", "--repo", REPO, "--json", "name"], { timeout: 20_000 });
    return new Set((JSON.parse(stdout) as { name: string }[]).map((s) => s.name));
  } catch {
    return null;
  }
}

async function dispatchTokenWorks(token: string): Promise<boolean> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  }).catch(() => null);
  return !!res?.ok;
}

export async function diagnose(env: Record<string, string | undefined> = process.env): Promise<Finding[]> {
  const findings: Finding[] = [];

  try {
    await getDb().execute(sql`select 1`);
    findings.push({ ok: true, required: true, what: "Database reachable" });
  } catch {
    findings.push({
      ok: false,
      required: true,
      what: "Database not reachable",
      fix: "Check DATABASE_URL in .env.local (Neon, pooled connection string).",
    });
  }

  const gmail = await checkGmail();
  findings.push(
    gmail.state === "connected"
      ? { ok: true, what: "Gmail connected: Email makes drafts" }
      : gmail.state === "expired"
        ? {
            ok: false,
            what: "Gmail refresh token expired: Email falls back to your mail app",
            fix: "pnpm gmail:auth, then put the new GOOGLE_REFRESH_TOKEN in Vercel too. It lasts 7 days until the OAuth consent screen is published.",
          }
        : {
            ok: false,
            what: `Gmail not set up (${gmail.state})`,
            fix: "Fill GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET in .env.local, then pnpm gmail:auth.",
          },
  );

  if (!env.GITHUB_DISPATCH_TOKEN) {
    findings.push({
      ok: false,
      what: "GITHUB_DISPATCH_TOKEN missing locally: Enhance, Run now and Discover show terminal commands",
      fix: "github.com → Settings → Developer settings → Fine-grained tokens: this repository only, Actions read and write. Put it in .env.local and in Vercel's environment variables.",
    });
  } else {
    const works = await dispatchTokenWorks(env.GITHUB_DISPATCH_TOKEN);
    findings.push(
      works
        ? { ok: true, what: "GITHUB_DISPATCH_TOKEN works: buttons start GitHub runs" }
        : { ok: false, what: "GITHUB_DISPATCH_TOKEN is set but GitHub refuses it", fix: "Make a new fine-grained token (Actions read and write, this repository) and replace it." },
    );
  }

  const secrets = await githubSecrets();
  if (!secrets) {
    findings.push({ ok: false, what: "GitHub secrets not checked", fix: "gh auth login, then run this again." });
  } else {
    findings.push(
      secrets.has("DATABASE_URL")
        ? { ok: true, required: true, what: "Secret DATABASE_URL: the nightly can reach the database" }
        : { ok: false, required: true, what: "Secret DATABASE_URL missing: the nightly cannot run", fix: "gh secret set DATABASE_URL" },
      secrets.has("CLAUDE_CODE_OAUTH_TOKEN")
        ? { ok: true, what: "Secret CLAUDE_CODE_OAUTH_TOKEN: Enhance can write on your Max plan" }
        : {
            ok: false,
            what: "Secret CLAUDE_CODE_OAUTH_TOKEN missing: Enhance cannot run on GitHub",
            fix: "claude setup-token, then: gh secret set CLAUDE_CODE_OAUTH_TOKEN",
          },
      secrets.has("SEC_USER_AGENT")
        ? { ok: true, what: "Secret SEC_USER_AGENT: discovery reads SEC Form D filings" }
        : {
            ok: false,
            what: "Secret SEC_USER_AGENT missing: discovery skips SEC EDGAR (US companies)",
            fix: 'gh secret set SEC_USER_AGENT, with a value like "Lead Engine you@example.com" (your own contact address).',
          },
    );
  }

  const resolver = await workingResolver();
  findings.push({
    ok: true,
    what:
      resolver === dns
        ? "DNS answers: email domain checks use this machine's resolver"
        : "DNS: this machine's resolver refuses queries; checks use 1.1.1.1 and 8.8.8.8 instead",
  });

  return findings;
}

export function report(findings: Finding[]): { text: string; failed: boolean } {
  const lines = findings.flatMap((f) => [`${f.ok ? "  ok " : "  -- "} ${f.what}`, ...(f.ok || !f.fix ? [] : [`       fix: ${f.fix}`])]);
  const waiting = findings.filter((f) => !f.ok).length;
  lines.push(
    "",
    waiting === 0 ? "Everything is set up." : `${waiting} to do. The live site's Inbox card lists what is missing there.`,
  );
  return { text: lines.join("\n"), failed: findings.some((f) => f.required && !f.ok) };
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/setup-check.ts")) {
  loadLocalEnv();
  diagnose()
    .then((findings) => {
      const { text, failed } = report(findings);
      console.log(text);
      process.exit(failed ? 1 : 0);
    })
    .catch((err) => {
      console.error("setup:check:", err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
