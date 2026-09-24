import { getBattlefield } from "@/lib/jobs";
import { rankBattlefield } from "@/lib/rank";
import { errorResponse, readJson } from "@/lib/http";

export const maxDuration = 900;

// Body: { rerank?: boolean }. Without rerank, only jobs that have no judgment
// under the active rubric are graded.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const battlefield = await getBattlefield((await params).id);
    const body = await readJson(request);
    const result = await rankBattlefield(battlefield.id, { rerank: body.rerank === true });
    return Response.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
