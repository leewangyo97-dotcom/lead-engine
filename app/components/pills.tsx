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
