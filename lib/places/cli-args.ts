/**
 * Argument parsing for the prospect scripts.
 *
 * Extracted so the nightly job's `--limit=25` is covered by a test. An
 * unbounded enrichment loop reading other people's servers is the one failure
 * this feature cannot afford, and "the flag probably parses" is not evidence.
 */
export interface ParsedArgs {
  searchId?: string;
  limit?: number;
}

export function parseArgs(argv: string[], fallbackLimit?: number): ParsedArgs {
  const positional = argv.filter((a) => !a.startsWith("-"));
  const flag = argv.find((a) => a.startsWith("--limit="))?.split("=")[1];

  const raw = flag ?? positional[1];
  const parsed = raw === undefined ? undefined : Number(raw);
  // A misspelt flag must not silently mean "no limit".
  const limit = parsed !== undefined && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;

  return { searchId: positional[0], limit: limit ?? fallbackLimit };
}
