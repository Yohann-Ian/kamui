import mammoth from "mammoth";
import { prisma } from "@/lib/prisma";
import { HttpError, errorResponse } from "@/lib/http";
import { requireResumesUnlocked } from "@/lib/resumeLock";

// A readable preview of a DOCX, which browsers cannot display: mammoth turns
// it into plain HTML (headings, paragraphs, lists, bold, tables, images). It
// keeps the content, not the exact fonts and layout; the PDF preview is exact.
// Served with a CSP that allows no scripts or external requests.
const PAGE_CSS = `
  html { background: #e9e9ec; }
  body { margin: 24px auto; max-width: 816px; background: #fff; color: #1a1a1a;
         padding: 56px 64px; box-shadow: 0 1px 6px rgba(0,0,0,.18);
         font: 15px/1.5 Georgia, "Times New Roman", serif; }
  h1, h2, h3 { font-family: Arial, Helvetica, sans-serif; line-height: 1.25; margin: 1.1em 0 .4em; }
  h1 { font-size: 24px; } h2 { font-size: 18px; } h3 { font-size: 16px; }
  p { margin: .35em 0; } ul, ol { margin: .3em 0 .6em 1.3em; padding: 0; }
  table { border-collapse: collapse; } td, th { padding: 2px 6px; vertical-align: top; }
  img { max-width: 100%; }
`;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireResumesUnlocked();
    const file = await prisma.resumeFile.findUnique({ where: { id: (await params).id } });
    if (!file || file.kind !== "docx") throw new HttpError(404, "No such DOCX file");

    const { value } = await mammoth.convertToHtml({ buffer: Buffer.from(file.data) });
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>${PAGE_CSS}</style></head><body>${
      value || "<p>This document has no text to preview.</p>"
    }</body></html>`;
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
