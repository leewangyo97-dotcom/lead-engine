import { refreshProspects, setOverrides, isOverridable, type Overrides } from "@/lib/places/refresh";

export const dynamic = "force-dynamic";
/** One prospect: an Overpass lookup, a page fetch, and maybe a contact page. */
export const maxDuration = 60;

/** Refreshes one prospect from OpenStreetMap and re-reads its website. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const progress = await refreshProspects({ ids: [id], enrich: true });
    if (progress.considered === 0) {
      return Response.json({ error: "no such prospect" }, { status: 404 });
    }
    const [result] = progress.results;
    return Response.json(result);
  } catch (err) {
    // fetchByIds already turns a 429 or 504 into a sentence a person can act on.
    return Response.json(
      { error: err instanceof Error ? err.message : "refresh failed" },
      { status: 502 },
    );
  }
}

/** Records a hand edit, which every later refresh must preserve. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }

  const edits: Overrides = {};
  for (const [field, value] of Object.entries(body)) {
    if (!isOverridable(field)) continue;
    if (value !== null && typeof value !== "string") {
      return Response.json({ error: `${field} must be a string or null` }, { status: 400 });
    }
    edits[field] = value;
  }

  if (Object.keys(edits).length === 0) {
    return Response.json({ error: "no editable fields in the request" }, { status: 400 });
  }

  const overrides = await setOverrides(id, edits);
  if (!overrides) return Response.json({ error: "no such prospect" }, { status: 404 });

  return Response.json({ id, overrides });
}
