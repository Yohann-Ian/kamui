import { notFound } from "next/navigation";
import { prisma } from "../../../../lib/prisma";
import Settings from "./Settings";

export const dynamic = "force-dynamic";

export default async function BattlefieldSettings({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const battlefield = await prisma.battlefield.findUnique({
    where: { slug },
    include: {
      rubrics: {
        orderBy: { version: "desc" },
        include: { _count: { select: { judgments: true } } },
      },
    },
  });
  if (!battlefield) notFound();

  return (
    <Settings
      battlefield={{
        id: battlefield.id,
        slug: battlefield.slug,
        name: battlefield.name,
        titleIncludes: battlefield.titleIncludes,
        titleExcludes: battlefield.titleExcludes,
        locations: battlefield.locations,
        maxBoards: battlefield.maxBoards,
        maxJobs: battlefield.maxJobs,
        maxJobsPerBoard: battlefield.maxJobsPerBoard,
        autoPopulate: battlefield.autoPopulate,
        autoRank: battlefield.autoRank,
        archived: battlefield.archived,
      }}
      rubrics={battlefield.rubrics.map((r) => ({
        id: r.id,
        version: r.version,
        active: r.active,
        body: r.body,
        createdOn: r.createdAt.toISOString().slice(0, 10),
        grades: r._count.judgments,
      }))}
    />
  );
}
