import { emptyFindings, type Findings, type PeopleProvider } from "./types";

/**
 * GitHub: company signals only.
 *
 * Whether the company has a GitHub organisation whose website is its own
 * domain, what languages its recent repositories use, and whether it pushed
 * code in the last 90 days. That says a technical team exists and what it
 * builds with.
 *
 * Never people. GitHub's Acceptable Use Policy forbids using information from
 * the service to send unsolicited email, so no member, profile or address is
 * read here (decision of 14 Oct).
 *
 * Uses GITHUB_TOKEN when set: 5,000 requests an hour, and Actions provides one
 * automatically. Without it the API allows 60 an hour and 10 searches a minute,
 * so the provider stays off rather than fail halfway through a run.
 */
const API = "https://api.github.com";
const ACTIVE_DAYS = 90;

interface Org {
  login: string;
  blog?: string | null;
}

interface Repo {
  language: string | null;
  pushed_at: string | null;
  fork: boolean;
}

export function blogMatches(blog: string | null | undefined, domain: string): boolean {
  if (!blog) return false;
  try {
    const host = new URL(/^https?:\/\//.test(blog) ? blog : `https://${blog}`).hostname.toLowerCase();
    return host === domain || host === `www.${domain}` || host.endsWith(`.${domain}`);
  } catch {
    return false;
  }
}

/** Top languages by repository count, and whether anything was pushed recently. */
export function repoSignals(repos: Repo[], now: Date): { techStack: string[]; activeOnGithub: boolean } {
  const counts = new Map<string, number>();
  let latest = 0;
  for (const repo of repos) {
    if (repo.fork) continue;
    if (repo.language) counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1);
    if (repo.pushed_at) latest = Math.max(latest, Date.parse(repo.pushed_at));
  }
  const techStack = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([l]) => l);
  return { techStack, activeOnGithub: latest > 0 && now.getTime() - latest < ACTIVE_DAYS * 86_400_000 };
}

export const githubProvider: PeopleProvider = {
  name: "github",

  disabledReason(company, env) {
    if (!env.GITHUB_TOKEN) return "GITHUB_TOKEN is not set (unauthenticated limits are too low for a run)";
    return company.domain ? null : "no domain to match an organisation against";
  },

  async run(company, _soFar, ctx): Promise<Findings> {
    const out = emptyFindings();
    const headers = {
      Authorization: `Bearer ${ctx.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    const get = async <T>(path: string): Promise<T | null> => {
      const res = await ctx.fetchText(`${API}${path}`, { headers, robots: false });
      if (!res) return null;
      try {
        return JSON.parse(res.text) as T;
      } catch {
        return null;
      }
    };

    const search = await get<{ items?: { login: string }[] }>(
      `/search/users?q=${encodeURIComponent(`${company.name} type:org`)}&per_page=5`,
    );
    for (const { login } of search?.items ?? []) {
      const org = await get<Org>(`/orgs/${encodeURIComponent(login)}`);
      if (!org || !blogMatches(org.blog, company.domain!)) continue;
      const repos = (await get<Repo[]>(`/orgs/${encodeURIComponent(login)}/repos?sort=pushed&per_page=20`)) ?? [];
      const { techStack, activeOnGithub } = repoSignals(repos, ctx.now());
      const url = `https://github.com/${org.login}`;
      out.company.signals.githubOrg = org.login;
      out.company.signals.activeOnGithub = activeOnGithub;
      if (techStack.length) out.company.signals.techStack = techStack;
      out.company.facts.push({ field: "githubOrg", value: org.login, sourceUrl: url, sourceType: "github" });
      if (techStack.length) {
        out.company.facts.push({ field: "techStack", value: techStack.join(", "), sourceUrl: url, sourceType: "github" });
      }
      break;
    }
    return out;
  },
};
