import { prisma } from "@/lib/prisma";
import { searchJobs } from "@/lib/apify";
import { APPLIED_STAGES, getBattlefield, saveToBattlefield, toJobData } from "@/lib/jobs";
import { rankBattlefield } from "@/lib/rank";
import { errorResponse } from "@/lib/http";

// An Apify sweep can take several minutes
export const maxDuration = 900;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const battlefield = await getBattlefield((await params).id);
    const run = await prisma.run.create({
      data: { battlefieldId: battlefield.id, kind: "search" },
    });

    let summary;
    try {
      const items = await searchJobs(
        {
          titleIncludes: battlefield.titleIncludes,
          titleExcludes: battlefield.titleExcludes,
          maxBoards: battlefield.maxBoards,
          maxJobs: battlefield.maxJobs,
          maxJobsPerBoard: battlefield.maxJobsPerBoard,
        },
        battlefield.locations
      );
      const jobs = items.map(toJobData);
      const { newJobIds } = await saveToBattlefield(battlefield.id, jobs);
      const alreadyApplied = await prisma.job.count({
        where: {
          battlefieldId: battlefield.id,
          atsJobId: { in: jobs.map((j) => j.atsJobId) },
          application: { status: { in: APPLIED_STAGES } },
        },
      });

      await prisma.run.update({
        where: { id: run.id },
        data: {
          status: "done",
          jobsFound: jobs.length,
          jobsNew: newJobIds.length,
          finishedAt: new Date(),
        },
      });
      summary = { found: jobs.length, new: newJobIds.length, alreadyApplied, newJobIds };
    } catch (e) {
      await prisma.run.update({
        where: { id: run.id },
        data: { status: "failed", error: String(e), finishedAt: new Date() },
      });
      throw e;
    }

    // Auto-Rank grades only this search's new arrivals. A ranking failure is
    // reported alongside the search result rather than failing the search.
    let rank = null;
    if (battlefield.autoRank && summary.newJobIds.length) {
      try {
        rank = await rankBattlefield(battlefield.id, { jobIds: summary.newJobIds });
      } catch (e) {
        rank = { error: e instanceof Error ? e.message : String(e) };
      }
    }

    return Response.json({
      runId: run.id,
      found: summary.found,
      new: summary.new,
      alreadyApplied: summary.alreadyApplied,
      rank,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
