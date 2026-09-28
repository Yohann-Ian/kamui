import { autoPopulateAll } from "@/lib/autoPopulate";
import { errorResponse, isCronRequest } from "@/lib/http";

// Starts a search for every Battlefield with Auto-Populate on, subject to the
// guards in lib/autoPopulate.ts. Called once a day by the Railway cron service
// (scripts/auto-populate.mjs). Returns at once: the sweep saves the results.
export async function POST(request: Request) {
  if (!isCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const results = await autoPopulateAll();
    return Response.json({
      started: results.filter((r) => r.status === "started"),
      skipped: results.filter((r) => r.status === "skipped"),
      failed: results.filter((r) => r.status === "failed"),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
