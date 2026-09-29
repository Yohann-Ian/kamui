import { prisma } from "@/lib/prisma";
import { HttpError, errorResponse } from "@/lib/http";
import { requireResumesUnlocked } from "@/lib/resumeLock";
import { MIME, disposition, isResumeKind } from "@/lib/resumes";

// Download a resume file, or with ?inline=1 show it in the browser (the PDF
// preview uses this).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireResumesUnlocked();
    const file = await prisma.resumeFile.findUnique({ where: { id: (await params).id } });
    if (!file || !isResumeKind(file.kind)) throw new HttpError(404, "No such file");

    const inline = new URL(request.url).searchParams.get("inline") === "1";
    return new Response(file.data, {
      headers: {
        "Content-Type": MIME[file.kind],
        "Content-Length": String(file.data.length),
        "Content-Disposition": disposition(inline ? "inline" : "attachment", file.fileName),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
