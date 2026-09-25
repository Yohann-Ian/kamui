import { notFound } from "next/navigation";
import { prisma } from "../../../lib/prisma";
import { daysSince, pickJudgment } from "../../../lib/battlefields";
import { APPLIED_STAGES } from "../../../lib/jobs";
import { ACTIVE } from "../../../lib/searchRuns";
import JobBoard from "./JobBoard";

export const dynamic = "force-dynamic";

type Raw = Record<string, unknown> | null;

// Pay as stated in the posting, when the actor found one
function payFrom(raw: Raw) {
  const min = Number(raw?.salaryMin);
  const max = Number(raw?.salaryMax);
  if (!raw || !Number.isFinite(min) || min <= 0) return null;
  const currency = typeof raw.salaryCurrency === "string" ? raw.salaryCurrency : null;
  const interval = typeof raw.salaryInterval === "string" ? raw.salaryInterval.toLowerCase() : null;
  return {
    min,
    max: Number.isFinite(max) && max > 0 ? max : min,
    currency,
    interval,
  };
}

function postedDaysFrom(raw: Raw) {
  const t = typeof raw?.postedAt === "string" ? Date.parse(raw.postedAt) : NaN;
  return Number.isFinite(t) ? daysSince(new Date(t)) : null;
}

export default async function Discovery({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const battlefield = await prisma.battlefield.findUnique({ where: { slug } });
  if (!battlefield) notFound();

  const [rubric, activeSearch, jobs] = await Promise.all([
    prisma.rubric.findFirst({ where: { battlefieldId: battlefield.id, active: true } }),
    // a search still running on Apify, so the toolbar can resume showing it
    prisma.run.findFirst({
      where: { battlefieldId: battlefield.id, kind: "search", status: { in: ACTIVE } },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    }),
    prisma.job.findMany({
      where: { battlefieldId: battlefield.id, dismissed: false },
      include: {
        judgments: { include: { rubric: { select: { version: true } } } },
        application: true,
        statusNotes: true,
      },
      orderBy: { lastSeenAt: "desc" },
      take: 500,
    }),
  ]);

  const applied = (job: (typeof jobs)[number]) =>
    !!job.application && APPLIED_STAGES.includes(job.application.status);
  const hiddenCount = jobs.filter(applied).length;
  // Counted the same way as rank-preview and the sidebar
  const unranked = jobs.filter(
    (j) => !j.closed && !j.judgments.some((jm) => !rubric || jm.rubricId === rubric.id)
  ).length;

  const data = jobs
    .filter((job) => !applied(job))
    .map((job) => {
      const judgment = pickJudgment(job.judgments, rubric?.id);
      const raw = job.raw as Raw;
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
        keyGap: judgment?.keyGap ?? null,
        // set when the grade came from an older rubric version
        staleRubricVersion:
          judgment && judgment.rubricId !== rubric?.id ? judgment.rubric.version : null,
        status: job.application?.status ?? null,
        notes: Object.fromEntries(job.statusNotes.map((n) => [n.stage, n.note])),
        closed: job.closed,
        lastSeenDays: daysSince(job.lastSeenAt),
        postedDays: postedDaysFrom(raw),
        pay: payFrom(raw),
      };
    });

  return (
    <JobBoard
      jobs={data}
      hiddenCount={hiddenCount}
      unranked={unranked}
      activeSearchRunId={activeSearch?.id ?? null}
      battlefield={{
        id: battlefield.id,
        slug: battlefield.slug,
        name: battlefield.name,
        titleIncludes: battlefield.titleIncludes,
        locations: battlefield.locations,
        archived: battlefield.archived,
        rubricVersion: rubric?.version ?? null,
      }}
    />
  );
}
