import { startExplore } from "@/lib/searchRuns";
import { HttpError, errorResponse, readJson } from "@/lib/http";

// Body: { query: string, locations?: string[] }. Creates the SearchWave, starts
// the Apify search and returns at once with the Run and wave ids. Poll
// GET /api/runs/<runId>; it saves the jobs into the wave when Apify is done.
// The wave has no Battlefield and nothing is ranked.
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (!query) throw new HttpError(400, "query is required");
    const locations = Array.isArray(body.locations)
      ? body.locations.filter((l): l is string => typeof l === "string" && l.trim() !== "")
      : [];

    const { run, wave } = await startExplore(query, locations);
    return Response.json({ runId: run.id, waveId: wave.id }, { status: 202 });
  } catch (e) {
    return errorResponse(e);
  }
}
