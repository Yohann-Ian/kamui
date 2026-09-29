import { prisma } from "../../lib/prisma";
import { isResumesUnlocked } from "../../lib/resumeLock";
import Lock from "./Lock";
import Resumes from "./Resumes";

export const dynamic = "force-dynamic";

// Battlefield > resume > version. The page is scoped to one Battlefield
// (?battlefield=<slug>); a resume and version are only selected inside it.
export default async function ResumesPage({
  searchParams,
}: {
  searchParams: Promise<{ battlefield?: string; resume?: string; version?: string }>;
}) {
  // Locked: show only the password screen and load nothing
  if (!(await isResumesUnlocked())) return <Lock />;

  const params = await searchParams;
  const battlefields = await prisma.battlefield.findMany({
    // archived Battlefields still show if they hold resumes
    where: { OR: [{ archived: false }, { resumes: { some: {} } }] },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    select: { id: true, slug: true, name: true, _count: { select: { resumes: true } } },
  });
  const current =
    battlefields.find((b) => b.slug === params.battlefield) ??
    battlefields.find((b) => b._count.resumes > 0) ??
    battlefields[0] ??
    null;

  const resumes = current
    ? await prisma.resume.findMany({
        where: { battlefieldId: current.id },
        orderBy: [{ createdAt: "asc" }, { name: "asc" }],
        include: {
          versions: {
            orderBy: { createdAt: "asc" },
            // never the file bytes here, only what the page shows
            include: {
              files: { select: { id: true, kind: true, fileName: true, size: true, uploadedAt: true } },
            },
          },
        },
      })
    : [];

  // A version or resume from another Battlefield is ignored
  const version = resumes.flatMap((r) => r.versions).find((v) => v.id === params.version) ?? null;
  const resume =
    resumes.find((r) => r.id === version?.resumeId) ?? resumes.find((r) => r.id === params.resume) ?? null;

  return (
    <Resumes
      key={`${current?.id}-${resume?.id}-${version?.id}`}
      battlefields={battlefields.map((b) => ({ id: b.id, slug: b.slug, name: b.name, count: b._count.resumes }))}
      battlefieldId={current?.id ?? null}
      selectedResumeId={resume?.id ?? null}
      selectedVersionId={version?.id ?? null}
      resumes={resumes.map((r) => ({
        id: r.id,
        name: r.name,
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
