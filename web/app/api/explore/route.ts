import { prisma } from "@/lib/prisma";
import { searchJobs } from "@/lib/apify";
import { toJobData } from "@/lib/jobs";
import { HttpError, errorResponse, readJson } from "@/lib/http";

export const maxDuration = 900;

// Explore searches are deliberately small; a wave can be promoted into a
// Battlefield with bigger caps later.
const EXPLORE_CAPS = { maxBoards: 500, maxJobs: 50, maxJobsPerBoard: 10 };

// Body: { query: string, locations?: string[] }. Saves the results as a
// SearchWave with no Battlefield and no ranking.
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (!query) throw new HttpError(400, "query is required");
    const locations = Array.isArray(body.locations)
      ? body.locations.filter((l): l is string => typeof l === "string" && l.trim() !== "")
      : [];

    const run = await prisma.run.create({ data: { kind: "search" } });
    try {
      const jobs = (await searchJobs({ query, ...EXPLORE_CAPS }, locations)).map(toJobData);
      const wave = await prisma.searchWave.create({
        data: {
          query,
          locations,
          jobCount: jobs.length,
          jobs: { createMany: { data: jobs } },
        },
        include: { jobs: true },
      });
      await prisma.run.update({
        where: { id: run.id },
        data: { status: "done", jobsFound: jobs.length, jobsNew: jobs.length, finishedAt: new Date() },
      });
      return Response.json({ runId: run.id, wave });
    } catch (e) {
      await prisma.run.update({
        where: { id: run.id },
        data: { status: "failed", error: String(e), finishedAt: new Date() },
      });
      throw e;
    }
  } catch (e) {
    return errorResponse(e);
  }
}
