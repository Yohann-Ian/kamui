import { prisma } from "./prisma";
import { Prisma } from "../generated/prisma/client";
import { HttpError } from "./http";

// A wave's own jobs: the rows saved by its Explore search, with no Battlefield.
export function waveJobs(waveId: string) {
  return prisma.job.findMany({
    where: { searchWaveId: waveId, battlefieldId: null },
    orderBy: { title: "asc" },
  });
}

// Copies a wave's jobs into a Battlefield, skipping ones it already has
// (per-Battlefield dedup on atsJobId). The copies are ordinary Battlefield jobs
// with no searchWaveId, so they never count as part of the wave. Nothing is ranked.
export async function copyWaveJobs(waveId: string, battlefieldId: string) {
  const wave = await prisma.searchWave.findUnique({ where: { id: waveId } });
  if (!wave) throw new HttpError(404, "No such search wave");
  const jobs = await waveJobs(waveId);

  const created = await prisma.job.createManyAndReturn({
    data: jobs.map((j) => ({
      atsJobId: j.atsJobId,
      battlefieldId,
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
  return { copied: created.length, skipped: jobs.length - created.length };
}
