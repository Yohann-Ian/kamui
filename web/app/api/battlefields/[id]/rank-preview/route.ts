import { getBattlefield } from "@/lib/jobs";
import { rankPreview } from "@/lib/rank";
import { errorResponse } from "@/lib/http";

// What clicking Rank would do, before paying for it.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const battlefield = await getBattlefield((await params).id);
    return Response.json(await rankPreview(battlefield.id));
  } catch (e) {
    return errorResponse(e);
  }
}
