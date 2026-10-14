import { exportRows, parseFilter, toCsv } from "@/lib/people/queries";

export const dynamic = "force-dynamic";

/**
 * CSV of the filtered decision-makers. The do-not-contact list is checked
 * before anything is written, and guessed addresses are left out (research
 * only): an export is how a list leaves this app, so it gets the strictest
 * rules (see `exportRows`).
 */
export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const rows = await exportRows(parseFilter(params));
  const date = new Date().toISOString().slice(0, 10);
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="decision-makers-${date}.csv"`,
    },
  });
}
