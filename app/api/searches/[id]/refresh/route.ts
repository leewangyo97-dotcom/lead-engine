import { refreshProspects } from "@/lib/places/refresh";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Refreshes every prospect in one search against OpenStreetMap.
 *
 * Map data only — websites are not revisited here. One Overpass request covers
 * the whole batch and finishes in seconds, while re-reading fifty websites at a
 * second per host would not fit in any request and belongs in `pnpm enrich`.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const progress = await refreshProspects({ searchId: id, enrich: false });
    return Response.json({
      considered: progress.considered,
      updated: progress.updated,
      unchanged: progress.unchanged,
      missing: progress.missing,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "refresh failed" },
      { status: 502 },
    );
  }
}
