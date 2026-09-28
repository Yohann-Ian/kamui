// Resume files: each version has one PDF slot and one DOCX slot. The bytes are
// stored in Postgres (Railway's disk does not survive a redeploy).

export const RESUME_KINDS = ["pdf", "docx"] as const;
export type ResumeKind = (typeof RESUME_KINDS)[number];

export const MAX_RESUME_BYTES = 10 * 1024 * 1024;

export const MIME: Record<ResumeKind, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export const isResumeKind = (k: unknown): k is ResumeKind =>
  typeof k === "string" && (RESUME_KINDS as readonly string[]).includes(k);

// Checks the file really is what its slot says: a PDF starts with "%PDF", a
// DOCX is a zip archive ("PK\x03\x04").
export function looksLike(kind: ResumeKind, bytes: Uint8Array) {
  const head = String.fromCharCode(...bytes.slice(0, 4));
  return kind === "pdf" ? head === "%PDF" : head === "PK\u0003\u0004";
}

// A, B, C ... Z, then V27, V28 ...
export function nextVersionLabel(existing: string[]) {
  for (let i = 0; i < 26; i++) {
    const label = String.fromCharCode(65 + i);
    if (!existing.includes(label)) return label;
  }
  for (let n = 27; ; n++) if (!existing.includes(`V${n}`)) return `V${n}`;
}

// Content-Disposition with a plain fallback and the exact UTF-8 name
export function disposition(type: "inline" | "attachment", fileName: string) {
  const plain = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${type}; filename="${plain}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export function formatBytes(n: number) {
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}
