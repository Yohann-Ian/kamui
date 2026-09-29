import { prisma } from "../../lib/prisma";
import { isResumesUnlocked } from "../../lib/resumeLock";
import Lock from "./Lock";
import Resumes from "./Resumes";

export const dynamic = "force-dynamic";

export default async function ResumesPage({
  searchParams,
}: {
  searchParams: Promise<{ version?: string }>;
}) {
  // Locked: show only the password screen and load nothing
  if (!(await isResumesUnlocked())) return <Lock />;

  const params = await searchParams;
  const [resumes, battlefields] = await Promise.all([
    prisma.resume.findMany({
      orderBy: [{ createdAt: "asc" }, { name: "asc" }],
      include: {
        battlefield: { select: { id: true, name: true } },
        versions: {
          orderBy: { createdAt: "asc" },
          // never the file bytes here, only what the page shows
          include: {
            files: { select: { id: true, kind: true, fileName: true, size: true, uploadedAt: true } },
          },
        },
      },
    }),
    prisma.battlefield.findMany({
      where: { archived: false },
      orderBy: [{ createdAt: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  const versions = resumes.flatMap((r) => r.versions);
  const selected =
    versions.find((v) => v.id === params.version) ?? resumes[0]?.versions.at(-1) ?? null;

  return (
    <Resumes
      key={selected?.id ?? "none"}
      battlefields={battlefields}
      selectedVersionId={selected?.id ?? null}
      resumes={resumes.map((r) => ({
        id: r.id,
        name: r.name,
        battlefieldId: r.battlefieldId,
        track: r.battlefield?.name ?? null,
        versions: r.versions.map((v) => ({
          id: v.id,
          label: v.label,
          notes: v.notes,
          createdOn: v.createdAt.toISOString().slice(0, 10),
          files: v.files.map((f) => ({
            id: f.id,
            kind: f.kind as "pdf" | "docx",
            fileName: f.fileName,
            size: f.size,
            uploadedOn: f.uploadedAt.toISOString().slice(0, 10),
            stamp: f.uploadedAt.getTime(),
          })),
        })),
      }))}
    />
  );
}
