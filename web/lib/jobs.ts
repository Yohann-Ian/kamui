import { prisma } from "./prisma";
import { Prisma } from "../generated/prisma/client";
import type { ActorJob } from "./apify";
import { HttpError } from "./http";

// Everything from Applied onward counts as "already applied to".
export const APPLIED_STAGES = ["Applied", "Screening", "Interview", "Offer", "Rejected", "Dropped"];

export type JobData = {
  atsJobId: string;
  source: string;
  company: string;
  title: string;
  location: string | null;
  locationBin: string | null;
  url: string;
  description: string | null;
  raw: Prisma.InputJsonValue | typeof Prisma.JsonNull;
};

// Same field mapping as worker/fetch.py.
export function toJobData(job: ActorJob): JobData {
  return {
    atsJobId: String(job.jobId),
    source: job.ats ?? "",
    company: job.company ?? "",
    title: job.title ?? "",
    location: job.location ?? null,
    locationBin: job.location ?? null,
    url: job.url ?? "",
    description: job.descriptionText ?? null,
    raw: job as Prisma.InputJsonValue,
  };
}

// Accepts either a Battlefield id or its slug.
export async function getBattlefield(idOrSlug: string) {
  const battlefield = await prisma.battlefield.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
  });
  if (!battlefield) throw new HttpError(404, `No Battlefield "${idOrSlug}"`);
  return battlefield;
}

// Dedup is per Battlefield on (battlefieldId, atsJobId). A job that is already
// there only gets its lastSeenAt bumped; new ones are inserted.
export async function saveToBattlefield(battlefieldId: string, jobs: JobData[]) {
  const ids = jobs.map((j) => j.atsJobId);
  const existing = await prisma.job.findMany({
    where: { battlefieldId, atsJobId: { in: ids } },
    select: { atsJobId: true },
  });
  const seen = new Set(existing.map((j) => j.atsJobId));
  const fresh = jobs.filter((j) => !seen.has(j.atsJobId));

  const [, created] = await prisma.$transaction([
    prisma.job.updateMany({
      where: { battlefieldId, atsJobId: { in: [...seen] } },
      data: { lastSeenAt: new Date() },
    }),
    prisma.job.createManyAndReturn({
      data: fresh.map((j) => ({ ...j, battlefieldId })),
      skipDuplicates: true,
      select: { id: true },
    }),
  ]);
  return { newJobIds: created.map((j) => j.id), alreadySeen: seen.size };
}
