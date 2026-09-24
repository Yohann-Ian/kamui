import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getBattlefield } from "@/lib/jobs";
import { uniqueSlug } from "@/lib/battlefields";
import { HttpError, errorResponse, readJson } from "@/lib/http";

const strings = (v: unknown) =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s.trim() !== "") : undefined;
const int = (v: unknown) => (Number.isInteger(v) && (v as number) > 0 ? (v as number) : undefined);

// Body: { battlefieldId } or { newBattlefield: { name, titleIncludes?, titleExcludes?,
// locations?, maxBoards?, maxJobs?, maxJobsPerBoard? } }.
// Copies the wave's jobs into the Battlefield (skipping ones it already has).
// The wave keeps its own rows; the copies are Battlefield jobs with no
// searchWaveId, so they never show up as part of the wave. Nothing is ranked.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const wave = await prisma.searchWave.findUnique({
      where: { id: (await params).id },
      include: { jobs: true },
    });
    if (!wave) throw new HttpError(404, "No such search wave");

    const body = await readJson(request);
    let battlefield;
    if (typeof body.battlefieldId === "string") {
      battlefield = await getBattlefield(body.battlefieldId);
    } else if (body.newBattlefield && typeof body.newBattlefield === "object") {
      const nb = body.newBattlefield as Record<string, unknown>;
      const name = typeof nb.name === "string" ? nb.name.trim() : "";
      if (!name) throw new HttpError(400, "newBattlefield.name is required");
      battlefield = await prisma.battlefield.create({
        data: {
          name,
          slug: await uniqueSlug(name),
          titleIncludes: strings(nb.titleIncludes) ?? [wave.query],
          titleExcludes: strings(nb.titleExcludes) ?? [],
          locations: strings(nb.locations) ?? wave.locations,
          maxBoards: int(nb.maxBoards),
          maxJobs: int(nb.maxJobs),
          maxJobsPerBoard: int(nb.maxJobsPerBoard),
        },
      });
    } else {
      throw new HttpError(400, "Send battlefieldId or newBattlefield");
    }

    const created = await prisma.job.createManyAndReturn({
      data: wave.jobs.map((j) => ({
        atsJobId: j.atsJobId,
        battlefieldId: battlefield.id,
        source: j.source,
        company: j.company,
        title: j.title,
        location: j.location,
        locationBin: j.locationBin,
        url: j.url,
        description: j.description,
        firstSeen: j.firstSeen,
        lastSeenAt: j.lastSeenAt,
        raw: j.raw ?? Prisma.JsonNull,
      })),
      skipDuplicates: true,
      select: { id: true },
    });

    return Response.json({
      battlefield,
      copied: created.length,
      skipped: wave.jobs.length - created.length,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
