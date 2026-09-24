import { timingSafeEqual } from "node:crypto";
import { sweepRunningSearches } from "@/lib/searchRuns";
import { errorResponse } from "@/lib/http";

export const maxDuration = 900;

// Requires "Authorization: Bearer <CRON_SECRET>". With CRON_SECRET unset, every
// call is refused.
function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Ingests every running search whose Apify runs have finished. Called every
// 5 minutes by the Railway cron service (scripts/sweep.mjs), so results are
// saved even when no browser is polling.
export async function POST(request: Request) {
  if (!authorized(request)) {
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
