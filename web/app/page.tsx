import { prisma } from "../lib/prisma";
import JobBoard from "./JobBoard";

export const dynamic = "force-dynamic";

const HIDDEN_STAGES = ["Applied", "Screening", "Interview", "Offer", "Rejected", "Dropped"];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ track?: string }>;
}) {
  const params = await searchParams;
  const track = params.track ?? "ai-ml";

  const jobs = await prisma.job.findMany({
    where: { track },
    include: { judgments: true, application: true, statusNotes: true },
    take: 200,
  });

  const hidden = jobs.filter(
    (job) => job.application && HIDDEN_STAGES.includes(job.application.status)
  );
  const visible = jobs.filter(
    (job) => !job.application || !HIDDEN_STAGES.includes(job.application.status)
  );

  const data = visible.map((job) => ({
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    url: job.url,
    description: job.description,
    grade: job.judgments[0]?.grade ?? null,
    score: job.judgments[0]?.score ?? null,
    reason: job.judgments[0]?.reason ?? null,
    status: job.application?.status ?? null,
    notes: Object.fromEntries(job.statusNotes.map((n) => [n.stage, n.note])),
  }));

  return <JobBoard jobs={data} hiddenCount={hidden.length} track={track} />;
}
