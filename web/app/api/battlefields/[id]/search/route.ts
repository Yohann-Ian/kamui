import { getBattlefield } from "@/lib/jobs";
import { startBattlefieldSearch } from "@/lib/searchRuns";
import { errorResponse, readJson } from "@/lib/http";

// Body (optional): { terms?: string[], locations?: string[] } from the search
// bar; locations are "all", "remote" or a place name. Missing fields fall back
// to the Battlefield's default settings.
// Starts the Battlefield's search on Apify and returns at once with the Run id.
// Poll GET /api/runs/<runId> for progress; it ingests the jobs when Apify is done.
// If a search is already running for this Battlefield, returns that one instead.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const battlefield = await getBattlefield((await params).id);
    const body = await readJson(request);
    const list = (v: unknown) =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim()) : undefined;
    const { run, alreadyRunning } = await startBattlefieldSearch(battlefield, {
      terms: list(body.terms),
      locations: list(body.locations),
    });
    return Response.json({ runId: run.id, alreadyRunning }, { status: 202 });
  } catch (e) {
    return errorResponse(e);
  }
}
