import Link from "next/link";
import { prisma } from "../lib/prisma";
import { daysSince, pickJudgment, resolveBattlefield } from "../lib/battlefields";
import { APPLIED_STAGES } from "../lib/jobs";
import { ACTIVE } from "../lib/searchRuns";
import JobBoard from "./JobBoard";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ battlefield?: string }>;
}) {
  const params = await searchParams;
  const { all, current } = await resolveBattlefield(params.battlefield);

  if (!current) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm text-gray-500">
          No Battlefields yet.{" "}
          <Link href="/battlefields/new" className="text-gray-900 underline">
            Create one
          </Link>{" "}
          to start searching.
        </p>
      </main>
    );
  }

  const [rubric, activeSearch, jobs] = await Promise.all([
    prisma.rubric.findFirst({ where: { battlefieldId: current.id, active: true } }),
    // a search still running on Apify, so the toolbar can resume showing it
    prisma.run.findFirst({
      where: { battlefieldId: current.id, kind: "search", status: { in: ACTIVE } },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    }),
    prisma.job.findMany({
      where: { battlefieldId: current.id, dismissed: false },
      include: {
        judgments: { include: { rubric: { select: { version: true } } } },
        application: true,
        statusNotes: true,
      },
      orderBy: { lastSeenAt: "desc" },
      take: 500,
    }),
  ]);

  const hidden = jobs.filter(
    (job) => job.application && APPLIED_STAGES.includes(job.application.status)
  );
  const visible = jobs.filter(
    (job) => !job.application || !APPLIED_STAGES.includes(job.application.status)
  );

  const data = visible.map((job) => {
    const judgment = pickJudgment(job.judgments, rubric?.id);
    return {
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      url: job.url,
      description: job.description,
      grade: judgment?.grade ?? null,
      score: judgment?.score ?? null,
      reason: judgment?.reason ?? null,
      // set when the grade came from an older rubric version
      staleRubricVersion:
        judgment && judgment.rubricId !== rubric?.id ? judgment.rubric.version : null,
      status: job.application?.status ?? null,
      notes: Object.fromEntries(job.statusNotes.map((n) => [n.stage, n.note])),
      closed: job.closed,
      lastSeenDays: daysSince(job.lastSeenAt),
    };
  });

  return (
    <JobBoard
      key={current.slug}
      jobs={data}
      hiddenCount={hidden.length}
      activeSearchRunId={activeSearch?.id ?? null}
      battlefields={all}
      battlefield={{
        id: current.id,
        slug: current.slug,
        name: current.name,
        titleIncludes: current.titleIncludes,
        locations: current.locations,
        archived: current.archived,
        rubricVersion: rubric?.version ?? null,
      }}
    />
  );
}
