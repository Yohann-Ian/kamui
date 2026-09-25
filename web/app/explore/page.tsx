import { prisma } from "../../lib/prisma";
import { waveJobs } from "../../lib/waves";
import Explore from "./Explore";

export const dynamic = "force-dynamic";

// Past searches are read from the database, so revisiting one costs nothing.
export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ wave?: string }>;
}) {
  const params = await searchParams;
  const [waves, battlefields] = await Promise.all([
    prisma.searchWave.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        runs: {
          orderBy: { startedAt: "desc" },
          take: 1,
          select: { id: true, status: true, error: true },
        },
      },
    }),
    prisma.battlefield.findMany({
      where: { archived: false },
      orderBy: [{ createdAt: "asc" }, { name: "asc" }],
      select: { id: true, slug: true, name: true },
    }),
  ]);
  const current = waves.find((w) => w.id === params.wave) ?? waves[0] ?? null;
  const jobs = current ? await waveJobs(current.id) : [];

  const when = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ") + " UTC";

  return (
    <Explore
      key={current?.id ?? "none"}
      waves={waves.map((w) => ({
        id: w.id,
        query: w.query,
        locations: w.locations,
        when: when(w.createdAt),
        jobCount: w.jobCount,
        // waves saved before searches became asynchronous have no linked Run
        runId: w.runs[0]?.id ?? null,
        runStatus: w.runs[0]?.status ?? "done",
        runError: w.runs[0]?.error ?? null,
      }))}
      currentId={current?.id ?? null}
      jobs={jobs.map((j) => ({
        id: j.id,
        title: j.title,
        company: j.company,
        location: j.location,
        url: j.url,
        description: j.description,
      }))}
      battlefields={battlefields}
    />
  );
}
