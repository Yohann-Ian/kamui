import { getBattlefield } from "@/lib/jobs";
import { startBattlefieldSearch } from "@/lib/searchRuns";
import { errorResponse } from "@/lib/http";

// Starts the Battlefield's search on Apify and returns at once with the Run id.
// Poll GET /api/runs/<runId> for progress; it ingests the jobs when Apify is done.
// If a search is already running for this Battlefield, returns that one instead.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const battlefield = await getBattlefield((await params).id);
    const { run, alreadyRunning } = await startBattlefieldSearch(battlefield);
    return Response.json({ runId: run.id, alreadyRunning }, { status: 202 });
  } catch (e) {
    return errorResponse(e);
  }
}
