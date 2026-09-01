import { spawnSync } from "node:child_process";

/**
 * Builds into .next-gate rather than .next.
 *
 * `next build` and `next dev` sharing a directory corrupts the dev server's
 * React client manifest mid-session. The page then returns 500 while the code is
 * fine, which has twice sent me chasing a bug that did not exist.
 *
 * A wrapper rather than an inline env var, because `VAR=x cmd` is not portable
 * to cmd.exe, which is what pnpm uses on Windows.
 */
const result = spawnSync("pnpm", ["exec", "next", "build"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NEXT_DIST_DIR: ".next-gate" },
});

process.exit(result.status ?? 1);
