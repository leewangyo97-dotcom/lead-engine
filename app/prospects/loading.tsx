import { Shell } from "@/app/components/shell";

/**
 * The prospects skeleton.
 *
 * Without this, a soft navigation here falls back to the root `loading.tsx`,
 * which says "Loading today's leads" — the wrong sentence on a page about
 * businesses, shown for up to several seconds while Neon wakes. On a phone that
 * reads as a black screen with a line of text about something else entirely.
 */
function Bar({ w, h }: { w: number; h: number }) {
  return (
    <span
      aria-hidden
      className="block animate-pulse rounded-xs bg-sunk"
      style={{ width: w, height: h }}
    />
  );
}

export default function Loading() {
  return (
    <Shell current="/prospects">
      <div className="mx-auto max-w-content">
        <h1
          className="font-display text-heading-lg text-primary"
          style={{ fontVariationSettings: "'opsz' 24, 'SOFT' 25, 'WONK' 0" }}
        >
          Find prospects
        </h1>
        <p className="mt-2 text-body-sm text-muted">Reading the prospect list…</p>

        <div className="mt-5 rounded-md border border-rule bg-surface p-5">
          <Bar w={64} h={10} />
          <div className="mt-3">
            <Bar w={320} h={38} />
          </div>
        </div>

        {/* Five rows: enough to hold the page still, not so many that the
            skeleton itself becomes the thing you are looking at. */}
        <ul className="mt-6 flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="rounded-md border border-rule bg-surface p-4">
              <div className="flex items-center gap-3">
                <Bar w={28} h={18} />
                <Bar w={200} h={14} />
              </div>
              <div className="mt-3">
                <Bar w={140} h={10} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Shell>
  );
}
