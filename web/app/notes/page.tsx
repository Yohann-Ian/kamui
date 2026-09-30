import { prisma } from "../../lib/prisma";
import Notes from "./Notes";

export const dynamic = "force-dynamic";

// Free-form notes, optionally filed under a Battlefield. ?note=<id> selects one.
export default async function NotesPage({ searchParams }: { searchParams: Promise<{ note?: string }> }) {
  const { note } = await searchParams;
  const [notes, battlefields] = await Promise.all([
    prisma.note.findMany({ orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }] }),
    prisma.battlefield.findMany({
      // archived Battlefields still show if they hold notes
      where: { OR: [{ archived: false }, { notes: { some: {} } }] },
      orderBy: [{ createdAt: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  return (
    <Notes
      notes={notes.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        pinned: n.pinned,
        battlefieldId: n.battlefieldId,
        updatedAt: n.updatedAt.toISOString(),
      }))}
      battlefields={battlefields}
      selectedId={notes.some((n) => n.id === note) ? note! : (notes[0]?.id ?? null)}
    />
  );
}
