import type { Lead } from "../db/schema";

/**
 * Stage 1: the whole rubric, in code, for free. Stage 2 only adjusts within
 * +/-15 and writes the reason — so anything computable belongs here, not in a
 * prompt. See memory/RUBRIC.md; bump RUBRIC_VERSION with every weight change so
 * old scores stay interpretable.
 */
export const RUBRIC_VERSION = "1.0.0";

export const NEEDS_DRAFT_THRESHOLD = 75;

export interface PrescoreInput {
  title: string;
  summary?: string | null;
  region?: string | null;
  remoteScope?: string | null;
  isContract: boolean;
  isDirect: boolean;
  contact?: string | null;
  payMinUsdHr?: number | null;
  stack: string[];
  postedAt?: Date | null;
}

export interface PrescoreResult {
  score: number;
  tier: "live" | "warn" | "cold";
  parts: {
    timezone: number;
    contract: number;
    stack: number;
    contact: number;
    pay: number;
    freshness: number;
  };
}

export function fromLead(lead: Lead): PrescoreInput {
  return {
    title: lead.title,
    summary: lead.summary,
    region: lead.region,
    remoteScope: lead.remoteScope,
    isContract: lead.isContract,
    isDirect: lead.isDirect,
    contact: lead.contact,
    payMinUsdHr: lead.payMinUsdHr,
    stack: lead.stack,
    postedAt: lead.postedAt,
  };
}

/** Max 30. An unqualified "remote" scores below a stated APAC one, deliberately. */
function timezonePoints(input: PrescoreInput): number {
  const text = `${input.region ?? ""} ${input.summary ?? ""}`.toLowerCase();
  switch (input.remoteScope) {
    case "worldwide":
      // "REMOTE" with no qualifier normalises to worldwide, but only a stated
      // global/anywhere earns the full 30 — the bare word is worth 15.
      return /worldwide|anywhere|global/.test(text) ? 30 : 15;
    case "apac":
      return 30;
    case "emea":
      return 22;
    case "us":
      return 6;
    case "onsite":
      return 0;
    default:
      return 0;
  }
}

/** Max 20. */
function contractPoints(input: PrescoreInput): number {
  const text = `${input.title} ${input.summary ?? ""} ${input.region ?? ""}`.toLowerCase();
  if (/\b(1099|b2b|freelance|contractor|contract-to-hire|c2h)\b/.test(text)) return 20;
  if (input.isContract) return /open to contract|contract possible|or contract/.test(text) ? 12 : 20;
  return 5;
}

/**
 * Max 25, highest match wins — not a sum. A posting naming Kotlin and Node is a
 * Kotlin lead; adding the two would rank it above a pure Kotlin role.
 */
const STACK_WEIGHTS: { points: number; tokens: string[] }[] = [
  { points: 25, tokens: ["kotlin", "android", "jetpack compose", "kmp", "cmp", "compose multiplatform"] },
  { points: 23, tokens: ["react-native", "flutter", "dart", "cross-platform mobile"] },
  { points: 19, tokens: ["typescript", "react", "next"] },
  { points: 16, tokens: ["node", "express"] },
  { points: 15, tokens: ["mcp", "agent tooling", "llm", "ai-assisted"] },
  { points: 14, tokens: ["ci/cd", "fastlane", "release engineering", "terraform"] },
  { points: 13, tokens: ["python", "django", "fastapi", "flask"] },
  { points: 11, tokens: ["vue", "nuxt", "php", "laravel"] },
];

function stackPoints(input: PrescoreInput): number {
  const haystack = `${input.stack.join(" ")} ${input.title} ${input.summary ?? ""}`.toLowerCase();
  let best = 0;
  for (const band of STACK_WEIGHTS) {
    if (band.points <= best) continue;
    if (band.tokens.some((t) => haystack.includes(t))) best = band.points;
  }
  return best;
}

/** Max 10. */
function contactPoints(input: PrescoreInput): number {
  if (!input.contact) return 2; // an ATS form is all that's on offer
  return input.isDirect ? 10 : 6;
}

/** Max 10. Unstated scores 4 — above a stated-but-low rate, which is a real signal. */
function payPoints(input: PrescoreInput): number {
  const rate = input.payMinUsdHr;
  if (rate == null) return 4;
  if (rate >= 60) return 10;
  if (rate >= 45) return 7;
  return 3;
}

/** Max 5. */
function freshnessPoints(input: PrescoreInput, now: Date): number {
  if (!input.postedAt) return 0;
  const days = (now.getTime() - input.postedAt.getTime()) / 86_400_000;
  if (days <= 7) return 5;
  if (days <= 21) return 3;
  return 0;
}

export function prescore(input: PrescoreInput, now = new Date()): PrescoreResult {
  const parts = {
    timezone: timezonePoints(input),
    contract: contractPoints(input),
    stack: stackPoints(input),
    contact: contactPoints(input),
    pay: payPoints(input),
    freshness: freshnessPoints(input, now),
  };

  const score = Object.values(parts).reduce((a, b) => a + b, 0);
  const tier = score >= 75 ? "live" : score >= 60 ? "warn" : "cold";
  return { score, tier, parts };
}
