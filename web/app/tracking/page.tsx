import { prisma } from "../../lib/prisma";
import TrackingBoard from "./TrackingBoard";

export const dynamic = "force-dynamic";

export default async function Tracking({
  searchParams,
}: {
  searchParams: Promise<{ track?: string }>;
}) {
  const params = await searchParams;
  const track = params.track ?? "ai-ml";

  const apps = await prisma.application.findMany({
    where: { job: { track } },
    include: { job: { include: { judgments: true, statusNotes: true } } },
    orderBy: { updatedAt: "desc" },
  });

  const data = apps.map((a) => ({
    id: a.job.id,
    title: a.job.title,
    company: a.job.company,
    location: a.job.location,
    url: a.job.url,
    description: a.job.description,
    grade: a.job.judgments[0]?.grade ?? null,
    score: a.job.judgments[0]?.score ?? null,
    reason: a.job.judgments[0]?.reason ?? null,
    status: a.status,
    notes: Object.fromEntries(a.job.statusNotes.map((n) => [n.stage, n.note])),
  }));

  return <TrackingBoard jobs={data} track={track} />;
}
