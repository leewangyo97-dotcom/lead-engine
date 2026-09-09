import type { ReactNode } from "react";

const TIER_STRIPE: Record<string, string> = {
  live: "bg-go",
  warn: "bg-hold",
  cold: "bg-rule-strong",
};

/** The left stripe is a severity encoding — the shape of the day before any text. */
export function TierStripe({ tier }: { tier: string }) {
  return (
    <span
      aria-hidden
      className={`w-1 self-stretch rounded-full ${TIER_STRIPE[tier] ?? TIER_STRIPE.cold}`}
    />
  );
}

export function Pill({
  tone = "default",
  children,
}: {
  tone?: "default" | "go" | "hold";
  children: ReactNode;
}) {
  const tones = {
    default: "bg-sunk text-muted",
    go: "bg-go-tint text-go",
    hold: "bg-hold-tint text-hold",
  };
  return <span className={`rounded-xs px-3 py-1 text-label uppercase ${tones[tone]}`}>{children}</span>;
}

export function Score({ value }: { value: number | null }) {
  return <span className="font-mono text-data-lg tabular-nums text-primary">{value ?? "--"}</span>;
}

/**
 * Figma's `Data/ScoreMeter` (3:1973): the number over a 3px track, filled to the
 * score in the tier's colour.
 *
 * The lead page had no score above the fold at all — it appeared only as the
 * total of the breakdown table, four sections down, so the one number that
 * decides whether a lead is worth reading was the last thing on screen.
 *
 * The track is drawn rather than given to `<progress>` deliberately: a progress
 * element announces a task completing, and this is a rank.
 */
export function ScoreMeter({ value, tier }: { value: number | null; tier: string }) {
  // A score is 0–100 by rubric, but the meter must not draw outside its track if
  // a future weighting overshoots.
  const filled = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="flex w-[52px] shrink-0 flex-col gap-1">
      <span className="font-mono text-data-lg tabular-nums text-primary">{value ?? "--"}</span>
      <span aria-hidden className="block h-[3px] w-full rounded-full bg-rule-soft">
        <span
          className={`block h-[3px] rounded-full ${TIER_STRIPE[tier] ?? TIER_STRIPE.cold}`}
          style={{ width: `${filled}%` }}
        />
      </span>
    </div>
  );
}
