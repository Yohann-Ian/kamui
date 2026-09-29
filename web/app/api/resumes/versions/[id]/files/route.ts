import { prisma } from "@/lib/prisma";
import { HttpError, errorResponse } from "@/lib/http";
import { requireResumesUnlocked } from "@/lib/resumeLock";
import { MAX_RESUME_BYTES, formatBytes, isResumeKind, looksLike } from "@/lib/resumes";

// Upload a file into a version's PDF or DOCX slot (form fields: kind, file).
// Replaces whatever the slot held. A route rather than a server action, because
// server actions cap request bodies at 1 MB.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireResumesUnlocked();
    const versionId = (await params).id;
    const version = await prisma.resumeVersion.findUnique({ where: { id: versionId }, select: { id: true } });
    if (!version) throw new HttpError(404, "No such resume version");

    const form = await request.formData();
    const kind = form.get("kind");
    const file = form.get("file");
    if (!isResumeKind(kind)) throw new HttpError(400, "kind must be pdf or docx");
    if (!(file instanceof File) || file.size === 0) throw new HttpError(400, "Choose a file to upload");
    if (file.size > MAX_RESUME_BYTES) {
      throw new HttpError(413, `That file is ${formatBytes(file.size)}; the limit is ${formatBytes(MAX_RESUME_BYTES)}`);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!looksLike(kind, bytes)) {
      throw new HttpError(400, `That is not a ${kind === "pdf" ? "PDF" : "Word .docx"} file`);
    }

    const data = { fileName: file.name, size: file.size, data: bytes, uploadedAt: new Date() };
    const saved = await prisma.resumeFile.upsert({
      where: { versionId_kind: { versionId, kind } },
      create: { versionId, kind, ...data },
      update: data,
      select: { id: true, kind: true, fileName: true, size: true },
    });
    return Response.json(saved);
  } catch (e) {
    return errorResponse(e);
  }
}
