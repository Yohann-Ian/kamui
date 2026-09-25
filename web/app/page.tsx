import { redirect } from "next/navigation";
import { prisma } from "../lib/prisma";
import { APPLIED_STAGES } from "../lib/jobs";
import { timeAgo } from "./shell/ui";
import Home from "./Home";

export const dynamic = "force-dynamic";

// Tile colours in order; a Battlefield that has never been searched and has no
// jobs is dormant and uses charcoal.
const TILE_COLOURS = ["bg-autumn-deep", "bg-slate", "bg-lavender"];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ battlefield?: string }>;
}) {
  // Old links of the form /?battlefield=<slug> go to that Battlefield
  const legacy = (await searchParams).battlefield;
  if (legacy) redirect(`/battlefields/${legacy}`);

  const battlefields = await prisma.battlefield.findMany({
    where: { archived: false },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    include: {
      runs: {
        where: { kind: "search" },
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { startedAt: true, status: true },
      },
    },
  });

  const tiles = await Promise.all(
    battlefields.map(async (b, i) => {
      const [fresh, applied, total] = await Promise.all([
        // new: first seen since the user last opened this Battlefield
        prisma.job.count({
          where: {
            battlefieldId: b.id,
            dismissed: false,
            ...(b.lastViewedAt ? { firstSeen: { gt: b.lastViewedAt } } : {}),
          },
        }),
        prisma.application.count({
          where: { job: { battlefieldId: b.id }, status: { in: APPLIED_STAGES } },
        }),
        prisma.job.count({ where: { battlefieldId: b.id } }),
      ]);
      const last = b.runs[0];
      const dormant = !last && total === 0;
      return {
        slug: b.slug,
        name: b.name,
        fresh,
        applied,
        colour: dormant ? "bg-charcoal" : TILE_COLOURS[i % TILE_COLOURS.length],
        searched: !last
          ? "Never searched"
          : last.status === "running" || last.status === "ingesting"
            ? "Searching now"
            : `Last searched ${timeAgo(last.startedAt)}`,
      };
    })
  );

  return <Home tiles={tiles} />;
}
