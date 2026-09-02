import { Shell } from "@/app/components/shell";

/**
 * Lead detail's loading state. Same reasoning as the inbox skeleton: the page is
 * dynamic, Neon may be waking, and a blank screen is worse than a stable one.
 *
 * The shapes follow this page's own layout rather than a Figma node — the file
 * has no lead-detail skeleton, and guessing at one would be inventing a design
 * rather than following it.
 */
export default function LeadLoading() {
  return (
    <Shell current="/">
      <div className="mx-auto max-w-content">
        <p role="status" className="sr-only">
          Loading lead
        </p>
        <span aria-hidden className="block h-8 w-64 animate-pulse rounded-xs bg-sunk" />
        <span aria-hidden className="mt-3 block h-5 w-80 animate-pulse rounded-xs bg-sunk" />
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <span
              key={i}
              aria-hidden
              className="block h-16 animate-pulse rounded-sm border border-rule bg-sunk"
            />
          ))}
        </div>
        <span aria-hidden className="mt-8 block h-40 w-full max-w-prose animate-pulse rounded-md bg-sunk" />
      </div>
    </Shell>
  );
}
