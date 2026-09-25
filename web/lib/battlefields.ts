import { prisma } from "./prisma";

export function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "battlefield";
}

export async function uniqueSlug(name: string) {
  const base = slugify(name);
  for (let n = 1; ; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    if (!(await prisma.battlefield.findUnique({ where: { slug } }))) return slug;
  }
}

// The Battlefield named by ?battlefield=<slug>, falling back to the oldest
// one that is not archived. Also returns the list for the switcher.
export async function resolveBattlefield(slug?: string) {
  const all = await prisma.battlefield.findMany({
    where: { archived: false },
    orderBy: { createdAt: "asc" },
  });
  const current =
    all.find((b) => b.slug === slug) ??
    (slug ? await prisma.battlefield.findUnique({ where: { slug } }) : null) ??
    all[0] ??
    null;
  return { all: all.map((b) => ({ slug: b.slug, name: b.name })), current };
}

type GradedJudgment = { rubricId: string; createdAt: Date };

// Ranked stays ranked: show the grade under the active rubric if there is one,
// otherwise the most recent grade from an older rubric version.
export function pickJudgment<J extends GradedJudgment>(
  judgments: J[],
  activeRubricId?: string
): J | null {
  const newestFirst = [...judgments].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return judgments.find((j) => j.rubricId === activeRubricId) ?? newestFirst[0] ?? null;
}

export function daysSince(date: Date) {
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

// Sidebar rows: each non-archived Battlefield with its count of unranked jobs,
// counted the same way as rank-preview (not dismissed or closed, and no
// judgment under the active rubric; every such job if there is no rubric yet).
export async function sidebarBattlefields() {
  const battlefields = await prisma.battlefield.findMany({
    where: { archived: false },
    orderBy: { createdAt: "asc" },
    include: { rubrics: { where: { active: true }, select: { id: true } } },
  });
  return Promise.all(
    battlefields.map(async (b) => ({
      slug: b.slug,
      name: b.name,
      unranked: await prisma.job.count({
        where: {
          battlefieldId: b.id,
          dismissed: false,
          closed: false,
          ...(b.rubrics[0] ? { judgments: { none: { rubricId: b.rubrics[0].id } } } : {}),
        },
      }),
    }))
  );
}
