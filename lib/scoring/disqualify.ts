import type { Lead } from "../db/schema";

/**
 * Hard rejects, run in code before any model sees a row. Every one of these is
 * cheap and certain; the expensive stage exists only for judgment calls.
 *
 * Order matters only for the reason string — the first match wins, so the most
 * decisive checks come first.
 */
export type DisqualifyReason =
  | "disqualified_stack"
  | "onsite_no_contract"
  | "language_required"
  | "citizenship_or_clearance"
  | "non_engineering_role"
  | "stale_posting"
  | "recently_contacted"
  | "unpaid_or_equity_only";

export const MAX_AGE_DAYS = 45;
export const CONTACT_COOLDOWN_DAYS = 90;

/** From memory/PROFILE.md — no experience, never claim. */
const DISQUALIFIED_STACK = [
  "embedded c",
  "microcontroller",
  "esp32",
  "stm32",
  "firmware",
  "rust systems",
  "solidity",
  "smart contract",
  "formal verification",
  "hpc",
  "cuda",
  "gpu cluster",
  "model training",
  "ml research",
  "research scientist",
];

/**
 * A disqualified language named as *the* language of the role, in the title.
 *
 * `DISQUALIFIED_STACK` above matches the phrase "rust systems", which missed
 * "Backend Systems Engineer (Rust)" — that reached stage 2 on the first real
 * batch and cost tokens to be scored 51.
 *
 * Deliberately title-only and deliberately narrow. Rust appearing among six
 * tags on a TypeScript job is not disqualifying; Rust in the role's own name is.
 */
const DISQUALIFIED_PRIMARY_LANGUAGE =
  /\((?:rust|go|golang|c\+\+|elixir|scala|haskell|erlang)\)|\b(?:rust|golang|c\+\+|haskell|erlang)\s+(?:engineer|developer|dev|programmer)\b|\b(?:senior|staff|principal|lead)?\s*(?:rust|haskell|erlang)\b\s*(?:engineer|developer)/i;

/** Languages Joshua does not speak, when the posting requires them. */
const LANGUAGE_REQUIRED =
  /\b(german|deutsch|japanese|日本語|korean|한국어|french|français|mandarin)\b[^.]{0,40}\b(required|fluent|native|speaker|proficien\w+|mandatory)\b|\b(fluent|native)\b[^.]{0,20}\b(german|japanese|korean|french)\b/i;

const CITIZENSHIP =
  /\b(us citizen|u\.s\. citizen|citizenship required|security clearance|ts\/sci|green card required|must be a citizen)\b/i;

/**
 * Titles that are unambiguously engineering. Checked first, because the list
 * below is deliberately broad and would otherwise reject a "Growth Engineer".
 */
const ENGINEERING_TITLE =
  /\b(engineer|engineering|developer|programmer|architect|sre|devops|full[- ]?stack|backend|back[- ]end|frontend|front[- ]end|mobile|android|ios|data scientist|tech lead|cto)\b/i;

/**
 * Non-engineering roles, matched on the title alone.
 *
 * Broad on purpose: these cost nothing to reject and a false negative sends a
 * business-development posting to a model that then has to spend tokens working
 * out it is not a job for a mobile contractor. "Founding Growth & Partnerships
 * Lead" reached stage 2 on the first real run because `growth` and
 * `partnerships` were missing here.
 */
const NON_ENGINEERING =
  /\b(sales|account executive|account manager|business development|bizdev|partnerships?|growth|marketer|marketing|recruit(er|ing)|talent acquisition|customer success|community manager|operations manager|ux designer|graphic designer|product designer|copywriter|content writer|paralegal|accountant|chief of staff|office manager)\b/i;

const UNPAID = /\b(unpaid|equity[- ]only|revenue[- ]share|profit[- ]share|volunteer|no salary|sweat equity)\b/i;

/** Everything the checks read. Keeps this pure and trivially testable. */
export interface DisqualifyInput {
  title: string;
  summary?: string | null;
  region?: string | null;
  remoteScope?: string | null;
  isContract: boolean;
  stack: string[];
  postedAt?: Date | null;
  /** Last time this company was contacted, from the outreach table. */
  lastContactedAt?: Date | null;
}

export function fromLead(lead: Lead, lastContactedAt?: Date | null): DisqualifyInput {
  return {
    title: lead.title,
    summary: lead.summary,
    region: lead.region,
    remoteScope: lead.remoteScope,
    isContract: lead.isContract,
    stack: lead.stack,
    postedAt: lead.postedAt,
    lastContactedAt,
  };
}

/** Returns the reason a lead is rejected, or null if it survives. */
export function disqualify(input: DisqualifyInput, now = new Date()): DisqualifyReason | null {
  const haystack = `${input.title} ${input.summary ?? ""}`.toLowerCase();

  if (DISQUALIFIED_STACK.some((s) => haystack.includes(s))) return "disqualified_stack";
  if (DISQUALIFIED_PRIMARY_LANGUAGE.test(input.title)) return "disqualified_stack";

  // Onsite is only fatal when there is no contract option — a contract that
  // happens to be onsite-preferred is still worth an email.
  if (input.remoteScope === "onsite" && !input.isContract) return "onsite_no_contract";

  if (LANGUAGE_REQUIRED.test(haystack)) return "language_required";
  if (CITIZENSHIP.test(haystack)) return "citizenship_or_clearance";
  // An engineering title wins outright: "Growth Engineer" is engineering.
  if (!ENGINEERING_TITLE.test(input.title) && NON_ENGINEERING.test(input.title)) {
    return "non_engineering_role";
  }
  if (UNPAID.test(haystack)) return "unpaid_or_equity_only";

  if (input.postedAt) {
    const ageDays = (now.getTime() - input.postedAt.getTime()) / 86_400_000;
    if (ageDays > MAX_AGE_DAYS) return "stale_posting";
  }

  if (input.lastContactedAt) {
    const sinceDays = (now.getTime() - input.lastContactedAt.getTime()) / 86_400_000;
    if (sinceDays < CONTACT_COOLDOWN_DAYS) return "recently_contacted";
  }

  return null;
}
