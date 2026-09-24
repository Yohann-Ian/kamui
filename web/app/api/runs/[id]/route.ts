import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRun } from "@/lib/searchRuns";
import { rankBattlefield } from "@/lib/rank";
import { errorResponse } from "@/lib/http";

// Gives after() room to finish an Auto-Rank on platforms that enforce this
export const maxDuration = 900;

// Status of a search Run. While Apify is still going it reports progress; the
// first call after every Apify run has finished ingests the jobs and marks the
// Run done. Safe to poll from several tabs: only one call ever ingests.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { summary, newJobIds } = await checkRun((await params).id);

    // Auto-Rank grades only this search's new arrivals, after the response is
    // sent, so ranking can never hold the request open. It writes its own Run.
    let autoRank: "started" | null = null;
    if (summary.battlefieldId && newJobIds.length) {
      const battlefield = await prisma.battlefield.findUnique({
        where: { id: summary.battlefieldId },
      });
      if (battlefield?.autoRank) {
        autoRank = "started";
        after(() =>
          rankBattlefield(battlefield.id, { jobIds: newJobIds }).catch((e) =>
            console.error("Auto-Rank failed", e)
          )
        );
      }
    }
    return Response.json({ ...summary, autoRank });
  } catch (e) {
    return errorResponse(e);
  }
}
