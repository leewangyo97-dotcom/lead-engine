import { hnWhoIsHiring } from "./hn-whoishiring";
import type { SourceAdapter } from "./types";

/**
 * The registry. Adding a source is a one-line change here plus one adapter file.
 * Do not add more sources until Phase 5 works end to end — a broader funnel in
 * front of an unfinished filter just costs more.
 */
export const adapters: SourceAdapter<never>[] = [hnWhoIsHiring as SourceAdapter<never>];

export { hnWhoIsHiring };
