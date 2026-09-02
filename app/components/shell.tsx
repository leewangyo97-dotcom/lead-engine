import { Suspense, type ReactNode } from "react";
import { cachedNavStatus } from "@/lib/nav-status";

/**
 * The app shell from `inbox-populated-lg` (Figma 3:787): a 56px topbar over a
 * 220px sidebar.
 *
 * The icons are drawn inline at the design system's 24px box rather than
 * imported from the 40 `Icons/*` symbols in the file. That is a deliberate
 * shortcut and the one place this shell is not traceable to a node — importing
 * the set properly is worth doing before any icon beyond these four is needed.
 */
const ICON = {
  inbox: "M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
  calendar:
    "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  search: "M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM21 21l-4.35-4.35",
  review: "M3 3v18h18M18.7 8l-5.1 5.2-2.8-2.7L7 14.3",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
} as const;

/**
 * The maker stamp from Figma 7:461 — a rounded base with a circular punch cut
 * out of its top-right corner. The mark is specified at 32px with a 24px glyph;
 * this renders the glyph at 24 in a 28px box, which is the topbar's own sizing
 * in lead-detail-lg (3:971).
 *
 * The punch is a mask rather than a background-coloured circle, so the mark
 * survives on any ground — a filled circle would show the wrong colour the
 * moment the topbar is not `surface`.
 */
function LogoMark() {
  return (
    <svg aria-hidden width="24" height="24" viewBox="0 0 24 24" className="shrink-0">
      <mask id="stamp-punch">
        <rect x="0" y="0" width="24" height="24" fill="white" />
        <circle cx="21" cy="3" r="5" fill="black" />
      </mask>
      <rect
        x="1"
        y="1"
        width="22"
        height="22"
        rx="5"
        fill="var(--accent-base)"
        mask="url(#stamp-punch)"
      />
    </svg>
  );
}

function Icon({ d }: { d: keyof typeof ICON }) {
  return (
    <svg
      aria-hidden
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d={ICON[d]} />
    </svg>
  );
}

const NAV = [
  { href: "/", label: "Inbox", icon: "inbox" },
  { href: "/prospects", label: "Find prospects", icon: "search" },
  { href: "/followups", label: "Follow-ups", icon: "calendar" },
  { href: "/rejected", label: "All leads", icon: "list" },
  // Not in the Figma sidebar, which lists four. The screen exists and dropping
  // its only entry point to match a mock would be a regression.
  { href: "/review", label: "Weekly review", icon: "review" },
  { href: "/settings", label: "Settings", icon: "settings" },
] as const;

/**
 * The counts come from the database, and `loading.tsx` renders this shell too,
 * so the query must not block the frame. Only the sidebar status suspends:
 * wrapping the whole shell would put `children` in both the fallback tree and
 * the resolved one, and render every page's queries twice.
 */
export function Shell({ current, children }: { current: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="flex h-[56px] items-center gap-3 border-b border-rule bg-surface px-6">
        <LogoMark />
        <span className="text-body-sm text-primary">Lead Engine</span>
      </header>

      <div className="flex flex-col md:flex-row">
        {/* A 220px sidebar on desktop, per Figma 3:793. On a phone it becomes a
            scrollable strip rather than disappearing: hiding it left the small
            screen with no navigation at all once the back-links were removed. */}
        <nav
          aria-label="Sections"
          className="shrink-0 border-b border-rule bg-surface md:w-[220px] md:border-b-0 md:border-r md:py-5"
        >
          <ul className="flex overflow-x-auto md:block">
            {NAV.map((item) => {
              const active = item.href === current;
              return (
                <li key={item.href}>
                  <a
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-body-sm transition-colors md:gap-3 md:border-b-0 md:border-l-2 md:py-3 md:pl-5 md:pr-4 ${
                      active
                        ? "border-accent bg-selected text-primary"
                        : "border-transparent text-secondary hover:bg-hovered"
                    }`}
                  >
                    <Icon d={item.icon} />
                    {item.label}
                    <Suspense fallback={null}>
                      <NavCount href={item.href} />
                    </Suspense>
                  </a>
                </li>
              );
            })}
          </ul>

          {/* Figma 3:1004 puts the engine's health at the foot of the sidebar.
              It is the one place a dead source is visible without opening the
              Actions log. */}
          <Suspense fallback={null}>
            <EngineHealth />
          </Suspense>
        </nav>

        <main className="min-w-0 flex-1 px-6 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}

/**
 * One query serves every badge: `getNavStatus` is called once per request and
 * React caches it, so six of these cost one round trip rather than six.
 */
async function NavCount({ href }: { href: string }) {
  const status = await cachedNavStatus();
  const count = status?.counts[href];
  if (!count) return null;
  return (
    <span className="ml-auto hidden rounded-xs bg-sunk px-2 py-0.5 font-mono text-data-sm tabular-nums text-muted md:inline">
      {count}
    </span>
  );
}

async function EngineHealth() {
  const s = await cachedNavStatus();
  if (!s) return null;
  return (
    <p className="mt-5 hidden items-center gap-2 px-5 md:flex">
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${
          s.health === "ok" ? "bg-go" : s.health === "warn" ? "bg-hold" : "bg-stop"
        }`}
      />
      <span className="text-caption text-faint">{s.healthLabel}</span>
    </p>
  );
}
