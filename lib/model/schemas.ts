import { z } from "zod";

/**
 * The model's output contract, and the reason nothing downstream trusts prose.
 *
 * Every one of these is validated before a single row is written. A malformed
 * batch fails loudly at the boundary rather than half-applying — a partially
 * written scoring run is worse than none, because the funnel counts stop meaning
 * anything and the next run cannot tell what was already done.
 */

/** Scoring. `reason` is capped hard: prose in a scoring response is pure waste. */
export const ScoreItem = z.object({
  id: z.string().min(1),
  score: z.number().int().min(0).max(100),
  tier: z.enum(["live", "warn", "cold"]),
  /** The adjustment applied, so a wrong score is traceable without a re-run. */
  delta: z.number().int().min(-15).max(15).optional(),
  reason: z.string().max(120),
});

export const ScoreBatch = z.object({
  scores: z.array(ScoreItem).min(1),
});

/**
 * Drafting. `proofUsed` is required and non-empty on purpose: a draft that
 * cannot say which PROFILE.md proof points it leaned on is either unfounded or
 * unauditable, and the verifier has nothing to check it against. The learning
 * loop needs `angle` for the same reason — without it, "what worked" is
 * unanswerable.
 */
export const DraftItem = z.object({
  leadId: z.string().min(1),
  subject: z.string().min(1).max(120),
  body: z.string().min(1),
  angle: z.string().min(1).max(60),
  proofUsed: z.array(z.string().min(1)).min(1),
});

export const DraftBatch = z.object({
  drafts: z.array(DraftItem).min(1),
});

/**
 * Verification. A pass is the absence of violations, not a claim of quality —
 * so `ok: true` with a non-empty `violations` array is rejected as incoherent
 * rather than quietly treated as a pass.
 */
/**
 * A violation names the offending text and the change needed, not just a
 * category. The copywriter gets exactly one retry, and "unsupported_claim" alone
 * does not tell it which sentence to fix.
 */
export const Violation = z.object({
  type: z.enum([
    "unsupported_claim",
    "disqualified_stack",
    "ai_overclaim",
    "region_mismatch",
    "dead_link",
    "no_ask",
    "multiple_asks",
  ]),
  quote: z.string().min(1).max(300),
  fix: z.string().min(1).max(300),
});

export const VerdictItem = z
  .object({
    leadId: z.string().min(1),
    ok: z.boolean(),
    violations: z.array(Violation),
  })
  .refine((v) => !v.ok || v.violations.length === 0, {
    message: "a verdict cannot be ok and carry violations",
  });

export const VerdictBatch = z.object({
  verdicts: z.array(VerdictItem).min(1),
});

export type ScoreItem = z.infer<typeof ScoreItem>;
export type DraftItem = z.infer<typeof DraftItem>;
export type VerdictItem = z.infer<typeof VerdictItem>;
export type Violation = z.infer<typeof Violation>;

/** Reads a JSON payload from stdin and validates it, or exits non-zero. */
export async function readValidatedStdin<T>(schema: z.ZodType<T>): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8").trim();

  if (!raw) {
    console.error("no input on stdin");
    process.exit(1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("stdin is not valid JSON");
    process.exit(1);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    console.error("payload failed validation:");
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}

/**
 * Enhanced prospect messages.
 *
 * `usedSignals` is required for the same reason `proofUsed` is required for
 * drafts: a message that cannot name the facts it leaned on is either invented
 * or unauditable, and the person sending it has no way to check it before it
 * reaches a stranger's phone.
 */
export const EnhanceItem = z.object({
  prospectId: z.string().min(1),
  /** Capped where WhatsApp readability stops, not where the model runs out. */
  message: z.string().min(1).max(500),
  angle: z.string().min(1).max(60),
  usedSignals: z.array(z.string().min(1)).min(1),
});

export const EnhanceBatch = z.object({
  enhanced: z.array(EnhanceItem).min(1),
});
