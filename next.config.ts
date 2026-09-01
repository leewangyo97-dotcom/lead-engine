import type { NextConfig } from "next";

const config: NextConfig = {
  // Vercel Hobby: non-commercial only. No `crons` here — the scheduler is
  // GitHub Actions (Hobby caps cron at once/day with +-59 min drift).
  typedRoutes: true,
  // Lets the gate build into its own directory. `next build` and `next dev`
  // sharing .next corrupts the dev server's client manifest, which surfaces as
  // phantom 500s on pages that are actually fine.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default config;
