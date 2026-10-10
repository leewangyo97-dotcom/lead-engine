import { Suspense, type ReactNode } from "react";
import { cachedNavStatus, formatCount } from "@/lib/nav-status";

/**
 * The app shell from `inbox-populated-lg` (Figma 3:787): a 56px topbar over a
 * 220px sidebar.
 *
 * The icons are the design's own, traced to their symbols in the file rather
 * than borrowed from an icon set that looks similar. They were Lucide paths
 * before, and the two do not match: Figma's inbox is a squarer tray
 * (`M3 12H7L9 15H15L17 12H21…`, straight sides from 3 to 21) where Lucide's has
 * an angled lid, and the design strokes at 1.5 where this drew 1.75.
 *
 * Each entry names its node. `review` is the exception and is marked as such:
 * the set has no chart glyph in the positions checked, and walking all forty
 * symbols to be sure was not worth it for one sidebar item.
 *
 * Primitives are kept as the export gives them — circle, rect, path — rather
 * than converted to path data by hand, which is a step that can only introduce
 * error.
 */
const ICON: Record<string, ReactNode> = {
  // Figma Icons/inbox (3:306)
  inbox: <path d="M3 12H7L9 15H15L17 12H21M3 12V19H21V12M3 12V5M21 12V5" />,
  // Figma Icons/search (3:310)
  search: (
    <>
      <circle cx="9.5" cy="9.5" r="5.75" />
      <path d="M13.8881 13.592L18.6419 18.025" />
    </>
  ),
  // Figma Icons/calendar (3:308)
  calendar: (
    <>
      <rect x="3.75" y="5.75" width="16.5" height="14.5" rx="1.25" />
      <path d="M3 10H21" />
      <path d="M8 3V7" />
      <path d="M16 3V7" />
    </>
  ),
  // Figma Icons/list (3:307). The bullets are filled, not stroked.
  list: (
    <>
      <path d="M9 7H20M9 12H20M9 17H20" />
      <circle cx="4" cy="7" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="4" cy="17" r="1.25" fill="currentColor" stroke="none" />
    </>
  ),
  // Figma Icons/settings (3:309) — two concentric circles, not a toothed gear.
  settings: (
    <>
      <circle cx="12" cy="12" r="3.25" />
      <circle cx="12" cy="12" r="8.25" />
    </>
  ),
  // No Figma counterpart: a bar chart for the weekly review, drawn to the same
  // 24px box and stroke weight as the rest.
  review: <path d="M3 3v18h18M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />,
};

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

/** 1.5, which is the weight every symbol in the file is drawn at. */
function Icon({ d }: { d: keyof typeof ICON }) {
  return (
    <svg
      aria-hidden
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {ICON[d]}
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
 *
 * Laid out after the Pivora reference (globals.css): a full-height grey
 * sidebar carrying the brand, the sections and the engine's health card; and
 * beside it a slim bar naming where you are. On a phone the sidebar becomes a
 * brand row over a scrollable strip rather than disappearing — hiding it left
 * the small screen with no navigation at all.
 */
export function Shell({ current, children }: { current: string; children: ReactNode }) {
  const here = NAV.find((item) => item.href === current);
  return (
    <div className="min-h-screen bg-canvas md:flex">
      <aside className="shrink-0 border-b border-rule bg-sunk md:sticky md:top-0 md:flex md:h-screen md:w-[248px] md:flex-col md:border-b-0 md:border-r">
        <div className="flex h-[56px] items-center gap-3 px-5 md:h-[64px]">
          <LogoMark />
          <div className="min-w-0">
            <p className="text-body-sm font-semibold leading-tight text-primary">Lead Engine</p>
            <p className="hidden text-caption leading-tight text-muted md:block">Lead pipeline</p>
          </div>
        </div>

        <nav aria-label="Sections" className="md:flex-1 md:overflow-y-auto md:px-3 md:pt-3">
          <ul className="flex gap-2 overflow-x-auto px-4 pb-3 md:block md:space-y-[2px] md:px-0 md:pb-0">
            {NAV.map((item) => {
              const active = item.href === current;
              return (
                <li key={item.href}>
                  <a
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-4 whitespace-nowrap rounded-md px-4 py-[7px] text-body-sm transition-colors ${
                      active
                        ? "bg-surface font-medium text-primary shadow-raised ring-1 ring-rule"
                        : "text-secondary hover:bg-hovered hover:text-primary"
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
        </nav>

        {/* The engine's health at the foot of the sidebar: the one place a dead
            source is visible without opening the Actions log. */}
        <Suspense fallback={null}>
          <EngineHealth />
        </Suspense>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 hidden h-[64px] items-center gap-3 border-b border-rule bg-canvas px-8 md:flex">
          {here ? <Icon d={here.icon} /> : null}
          <span className="text-subhead text-primary">{here?.label ?? "Lead Engine"}</span>
        </header>
        <main className="px-5 py-6 md:px-8 md:py-7">{children}</main>
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
    <span
      title={`${count.toLocaleString()} waiting`}
      className="ml-auto hidden text-data-sm tabular-nums text-muted md:inline"
    >
      {formatCount(count)}
    </span>
  );
}

async function EngineHealth() {
  const s = await cachedNavStatus();
  if (!s) return null;
  return (
    <div className="mx-3 mb-4 mt-4 hidden rounded-lg border border-rule bg-surface p-4 md:block">
      <p className="flex items-center gap-3 text-body-sm font-medium text-primary">
        <span
          aria-hidden="true"
          className={`h-[8px] w-[8px] shrink-0 rounded-full ${
            s.health === "ok" ? "bg-go" : s.health === "warn" ? "bg-hold" : "bg-stop"
          }`}
        />
        Engine
      </p>
      <p className="mt-1 text-caption text-muted">{s.healthLabel}</p>
    </div>
  );
}
