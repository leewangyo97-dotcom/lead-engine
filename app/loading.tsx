import { Shell } from "./components/shell";

/**
 * The inbox loading state, from Figma 3:1285 `inbox-skeleton-lg`.
 *
 * Not decoration. Every page here is `force-dynamic` against Neon, which
 * autosuspends after five minutes idle and takes a few seconds to wake — so the
 * first visit of the morning currently shows nothing at all while it does. The
 * skeleton keeps the layout stable so the real content does not shove the page
 * around when it lands.
 *
 * The placeholder sizes are the design's: 64x10 label, 48x24 value, 80x12
 * caption in a tile; 4x24 stripe, 44x24 score, 180x14 over 240x10, then 120x16
 * and 80x16 on the right of a row.
 */
function Bar({ w, h, className = "" }: { w: number; h: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded-xs bg-sunk ${className}`}
      style={{ width: w, height: h }}
    />
  );
}

export default function InboxLoading() {
  return (
    <Shell current="/">
      <div className="mx-auto max-w-content">
        {/* Screen readers get one honest announcement rather than a wall of
            placeholder boxes. */}
        <p role="status" className="sr-only">
          Loading today&rsquo;s leads
        </p>

        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <h1
            className="font-display text-heading-lg text-primary"
            style={{ fontVariationSettings: "'opsz' 24, 'SOFT' 25, 'WONK' 0" }}
          >
            Inbox
          </h1>
          <Bar w={140} h={16} />
        </header>

        <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-md border border-rule bg-surface sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className={`px-5 py-4 ${i > 0 ? "border-l border-rule" : ""}`}>
              <Bar w={64} h={10} />
              <Bar w={48} h={24} className="mt-2" />
              <Bar w={80} h={12} className="mt-2" />
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-6 border-b border-rule pb-2">
          <Bar w={46} h={20} />
          <Bar w={76} h={20} />
          <Bar w={21} h={20} />
        </div>

        <ul className="mt-4 overflow-hidden rounded-md border border-rule bg-surface">
          {Array.from({ length: 6 }, (_, i) => (
            <li
              key={i}
              className={`flex items-center gap-4 px-4 py-3 ${
                i > 0 ? "border-t border-rule-soft" : ""
              }`}
            >
              <Bar w={4} h={24} />
              <Bar w={44} h={24} />
              <div className="min-w-0 flex-1">
                <Bar w={180} h={14} />
                <Bar w={240} h={10} className="mt-2" />
              </div>
              <div className="hidden shrink-0 items-center gap-4 sm:flex">
                <Bar w={120} h={16} />
                <Bar w={80} h={16} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Shell>
  );
}
