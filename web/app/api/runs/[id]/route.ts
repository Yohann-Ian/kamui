import { autoRankAfter, checkRun } from "@/lib/searchRuns";
import { errorResponse } from "@/lib/http";

// Gives after() room to finish an Auto-Rank on platforms that enforce this
export const maxDuration = 900;

// Status of a search Run, polled by the UI to show progress. If every Apify run
// has finished it also ingests the jobs, so results appear without waiting for
// the next sweep (POST /api/runs/sweep does the same for searches nobody is
// watching). Only one caller ever ingests a Run.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { summary, newJobIds } = await checkRun((await params).id);
    const autoRank = await autoRankAfter(summary.battlefieldId, newJobIds);
    return Response.json({ ...summary, autoRank });
  } catch (e) {
    return errorResponse(e);
  }
}
