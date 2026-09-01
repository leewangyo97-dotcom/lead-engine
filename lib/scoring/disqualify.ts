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

/** Languages Joshua does not speak, when the posting requires them. */
const LANGUAGE_REQUIRED =
  /\b(german|deutsch|japanese|日本語|korean|한국어|french|français|mandarin)\b[^.]{0,40}\b(required|fluent|native|speaker|proficien\w+|mandatory)\b|\b(fluent|native)\b[^.]{0,20}\b(german|japanese|korean|french)\b/i;

const CITIZENSHIP =
  /\b(us citizen|u\.s\. citizen|citizenship required|security clearance|ts\/sci|green card required|must be a citizen)\b/i;

const NON_ENGINEERING =
  /\b(sales|account executive|marketing|growth marketer|recruit(er|ing)|talent acquisition|customer success|community manager|(?<!design )operations manager|ux designer|graphic designer|product designer|copywriter|content writer|paralegal|accountant)\b/i;

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

  // Onsite is only fatal when there is no contract option — a contract that
  // happens to be onsite-preferred is still worth an email.
  if (input.remoteScope === "onsite" && !input.isContract) return "onsite_no_contract";

  if (LANGUAGE_REQUIRED.test(haystack)) return "language_required";
  if (CITIZENSHIP.test(haystack)) return "citizenship_or_clearance";
  if (NON_ENGINEERING.test(input.title)) return "non_engineering_role";
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
