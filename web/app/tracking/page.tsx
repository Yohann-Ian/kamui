import { prisma } from "../../lib/prisma";
import { pickJudgment, resolveBattlefield } from "../../lib/battlefields";
import TrackingBoard from "./TrackingBoard";

export const dynamic = "force-dynamic";

export default async function Tracking({
  searchParams,
}: {
  searchParams: Promise<{ battlefield?: string }>;
}) {
  const params = await searchParams;
  const { current } = await resolveBattlefield(params.battlefield);

  const [rubric, apps] = await Promise.all([
    prisma.rubric.findFirst({ where: { battlefieldId: current?.id ?? "", active: true } }),
    prisma.application.findMany({
      where: { job: { battlefieldId: current?.id ?? "" } },
      include: { job: { include: { judgments: true, statusNotes: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const data = apps.map((a) => {
    const judgment = pickJudgment(a.job.judgments, rubric?.id);
    return {
      id: a.job.id,
      title: a.job.title,
      company: a.job.company,
      location: a.job.location,
      url: a.job.url,
      description: a.job.description,
      grade: judgment?.grade ?? null,
      score: judgment?.score ?? null,
      reason: judgment?.reason ?? null,
      status: a.status,
      notes: Object.fromEntries(a.job.statusNotes.map((n) => [n.stage, n.note])),
    };
  });

  return (
    <TrackingBoard
      key={current?.slug}
      jobs={data}
      battlefield={current ? { slug: current.slug, name: current.name } : null}
    />
  );
}
