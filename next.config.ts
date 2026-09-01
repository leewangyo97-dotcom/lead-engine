import type { NextConfig } from "next";

const config: NextConfig = {
  // Vercel Hobby: non-commercial only. No `crons` here — the scheduler is
  // GitHub Actions (Hobby caps cron at once/day with +-59 min drift).
  typedRoutes: true,
};

export default config;
