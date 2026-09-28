import { sweepRunningSearches } from "@/lib/searchRuns";
import { errorResponse, isCronRequest } from "@/lib/http";

export const maxDuration = 900;

// Ingests every running search whose Apify runs have finished. Called every
// 5 minutes by the Railway cron service (scripts/sweep.mjs), so results are
// saved even when no browser is polling.
export async function POST(request: Request) {
  if (!isCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { reclaimed, results } = await sweepRunningSearches();
    return Response.json({
      reclaimed,
      checked: results.length,
      finished: results.filter((r) => r.status !== "running").length,
      results,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
