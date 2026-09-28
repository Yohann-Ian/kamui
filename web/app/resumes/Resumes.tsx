"use client";

// Resumes: a compact column on the left (resumes grouped by track with their
// version chips, then the selected version's files and notes), and the rest of
// the screen for previewing the selected version.

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addVersion,
  createResume,
  deleteResume,
  deleteVersion,
  removeFile,
  saveVersionNotes,
  updateResume,
} from "./actions";
import { CardLabel, btnPrimary, btnSecondary, field } from "../shell/ui";

type Kind = "pdf" | "docx";
type ResumeFile = { id: string; kind: Kind; fileName: string; size: number; uploadedOn: string; stamp: number };
type Version = { id: string; label: string; notes: string; createdOn: string; files: ResumeFile[] };
type Resume = { id: string; name: string; battlefieldId: string | null; track: string | null; versions: Version[] };
type Battlefield = { id: string; name: string };

const KIND_LABEL: Record<Kind, string> = { pdf: "PDF", docx: "DOCX" };
const ACCEPT: Record<Kind, string> = {
  pdf: ".pdf,application/pdf",
  docx: ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
const errorMark = "font-semibold underline decoration-grade-unfit decoration-2 underline-offset-4";
const small = "rounded-btn border border-secondary-edge bg-secondary px-2.5 py-1 text-label font-semibold hover:bg-hover";

const size = (n: number) =>
  n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

function NewResume({ battlefields, onDone }: { battlefields: Battlefield[]; onDone?: () => void }) {
  const [state, action, pending] = useActionState(createResume, {});
  return (
    <form action={action} className="mt-2 mb-3 space-y-2 rounded-row bg-row-selected p-2.5">
      <input name="name" placeholder="Name, e.g. AI Engineer resume" aria-label="Resume name"
        className={`${field} w-full placeholder:text-white placeholder:opacity-80`} />
      <select name="battlefieldId" aria-label="Track" className={`${field} w-full`} defaultValue={battlefields[0]?.id ?? ""}>
        {battlefields.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
        <option value="">Any track</option>
      </select>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className={`${btnPrimary} py-1.5`}>
          {pending ? "Creating..." : "Create"}
        </button>
        {onDone ? (
          <button type="button" onClick={onDone} className={`${btnSecondary} py-1.5`}>Cancel</button>
        ) : null}
        {state.error ? <span className={`text-meta ${errorMark}`}>{state.error}</span> : null}
      </div>
    </form>
  );
}

function Slot({ versionId, kind, file }: { versionId: string; kind: Kind; file: ResumeFile | undefined }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function upload(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append("kind", kind);
    form.append("file", f);
    try {
      const res = await fetch(`/api/resumes/versions/${versionId}/files`, { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-row px-2 py-2 hover:bg-row-selected">
      <div className="flex items-center gap-2.5">
        <span className="w-10 shrink-0 font-mono text-label font-semibold">{KIND_LABEL[kind]}</span>
        <span className="min-w-0 flex-1">
          {file ? (
            <>
              <span className="block truncate text-meta font-medium" title={file.fileName}>{file.fileName}</span>
              <span className="block text-label font-medium opacity-85">
                {size(file.size)} · {file.uploadedOn}
              </span>
            </>
          ) : (
            <span className="block text-meta font-medium opacity-85">Empty</span>
          )}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {file ? (
          <a href={`/api/resumes/files/${file.id}`} className={small}>Download</a>
        ) : null}
        <label className={`${small} cursor-pointer`}>
          {busy ? "Uploading..." : file ? "Replace" : "Upload"}
          <input type="file" accept={ACCEPT[kind]} className="hidden" disabled={busy}
            onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {file ? (
          <button className={small}
            onClick={() => confirm(`Remove ${file.fileName}?`) && startTransition(() => removeFile(file.id))}>
            Remove
          </button>
        ) : null}
      </div>
      {error ? <p className={`mt-1 text-label ${errorMark}`}>{error}</p> : null}
    </li>
  );
}

export default function Resumes({
  resumes,
  battlefields,
  selectedVersionId,
}: {
  resumes: Resume[];
  battlefields: Battlefield[];
  selectedVersionId: string | null;
}) {
  const [creating, setCreating] = useState(resumes.length === 0);
  const [notesState, setNotesState] = useState<"idle" | "saving" | "saved">("idle");
  const [pending, startTransition] = useTransition();

  const resume = resumes.find((r) => r.versions.some((v) => v.id === selectedVersionId)) ?? null;
  const version = resume?.versions.find((v) => v.id === selectedVersionId) ?? null;
  const pdf = version?.files.find((f) => f.kind === "pdf");
  const docx = version?.files.find((f) => f.kind === "docx");
  const [view, setView] = useState<Kind>(pdf ? "pdf" : "docx");
  const shown = view === "pdf" ? pdf ?? docx : docx ?? pdf;
  const previewSrc = !shown
    ? null
    : shown.kind === "pdf"
      ? `/api/resumes/files/${shown.id}?inline=1&t=${shown.stamp}#view=FitH`
      : `/api/resumes/files/${shown.id}/preview?t=${shown.stamp}`;

  // group by track, "Any track" last
  const groups = new Map<string, Resume[]>();
  for (const r of resumes) {
    const key = r.track ?? "Any track";
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) =>
    a === "Any track" ? 1 : b === "Any track" ? -1 : 0
  );
  const versionCount = resumes.reduce((n, r) => n + r.versions.length, 0);

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 px-6 pt-6">
      <div className="shrink-0">
        <h1 className="font-display text-heading font-bold tracking-[-0.015em]">Resumes</h1>
        <p className="mt-1 text-item font-medium">
          {resumes.length} {resumes.length === 1 ? "resume" : "resumes"}, {versionCount}{" "}
          {versionCount === 1 ? "version" : "versions"}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 gap-4 pb-4">
        {/* the selection: kept narrow so the preview gets the screen */}
        <div className="panel-scroll flex w-[20rem] shrink-0 flex-col gap-3 overflow-y-auto pr-1">
          <div className="glass-card px-3.5 py-3">
            <div className="flex items-center justify-between">
              <CardLabel>All resumes</CardLabel>
              {!creating ? (
                <button onClick={() => setCreating(true)} className={small}>+ New</button>
              ) : null}
            </div>
            {creating ? (
              <NewResume battlefields={battlefields} onDone={resumes.length ? () => setCreating(false) : undefined} />
            ) : null}
            {resumes.length === 0 ? (
              <p className="mt-1 text-meta font-medium">No resumes yet. Create one, then upload its PDF and DOCX.</p>
            ) : (
              ordered.map(([track, list]) => (
                <div key={track} className="mt-2.5">
                  <div className="px-1 pb-1 text-label font-semibold opacity-85">{track}</div>
                  {list.map((r) => (
                    <div key={r.id}
                      className={`rounded-row px-2 py-1.5 ${r.id === resume?.id ? "bg-row-selected" : ""}`}>
                      <div className="truncate text-item font-medium" title={r.name}>{r.name}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {r.versions.map((v) => (
                          <Link key={v.id} href={`/resumes?version=${v.id}`}
                            className={`min-w-7 rounded-btn border px-1.5 py-0.5 text-center font-mono text-label font-semibold ${
                              v.id === version?.id
                                ? "border-autumn-deep bg-autumn-deep"
                                : "border-secondary-edge bg-secondary hover:bg-hover"
                            }`}
                            title={`Version ${v.label}`}>
                            {v.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          {resume && version ? (
            <div className="glass-card px-3.5 py-3">
              <CardLabel>Selected</CardLabel>
              <input key={`name-${resume.id}`} defaultValue={resume.name} aria-label="Resume name"
                onBlur={(e) => e.target.value.trim() !== resume.name &&
                  startTransition(() => updateResume(resume.id, e.target.value, resume.battlefieldId))}
                className={`${field} mt-2 w-full font-semibold`} />
              <select key={`track-${resume.id}`} defaultValue={resume.battlefieldId ?? ""} aria-label="Track"
                onChange={(e) => startTransition(() => updateResume(resume.id, resume.name, e.target.value || null))}
                className={`${field} mt-2 w-full`}>
                {battlefields.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
                <option value="">Any track</option>
              </select>

              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-sub font-semibold">
                  Version <span className="font-mono">{version.label}</span>
                  <span className="ml-2 text-label font-medium opacity-85">{version.createdOn}</span>
                </span>
                <button disabled={pending} onClick={() => startTransition(() => addVersion(resume.id))} className={small}>
                  + New version
                </button>
              </div>

              <label htmlFor="notes" className="mt-3 flex items-baseline justify-between">
                <CardLabel>What is different</CardLabel>
                <span className="text-label font-medium opacity-85">
                  {notesState === "saving" ? "saving..." : notesState === "saved" ? "saved" : ""}
                </span>
              </label>
              <textarea id="notes" defaultValue={version.notes} rows={5}
                placeholder="The subtle nuances of this version: what it emphasises, where you sent it..."
                onChange={() => setNotesState("idle")}
                onBlur={(e) => {
                  if (e.target.value === version.notes) return;
                  setNotesState("saving");
                  saveVersionNotes(version.id, e.target.value).then(() => setNotesState("saved"));
                }}
                className={`${field} mt-1.5 w-full resize-y leading-[1.5] placeholder:text-white placeholder:opacity-80`} />

              <CardLabel className="mt-3">Files</CardLabel>
              <ul className="mt-1">
                <Slot versionId={version.id} kind="pdf" file={pdf} />
                <Slot versionId={version.id} kind="docx" file={docx} />
              </ul>

              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-divider pt-2.5 text-label font-semibold">
                <button className="underline underline-offset-2"
                  onClick={() => confirm(`Delete version ${version.label} and its files?`) &&
                    startTransition(() => deleteVersion(version.id))}>
                  Delete version {version.label}
                </button>
                <button className="underline underline-offset-2"
                  onClick={() => confirm(`Delete "${resume.name}" and all ${resume.versions.length} of its versions?`) &&
                    startTransition(() => deleteResume(resume.id))}>
                  Delete resume
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* the preview gets everything else */}
        <div className="glass-card flex min-w-0 flex-1 flex-col p-2.5">
          {shown && version ? (
            <>
              <div className="flex shrink-0 items-center justify-between gap-3 px-1.5 pb-2">
                <span className="truncate text-meta font-semibold">
                  {resume?.name} · Version {version.label} · {shown.fileName}
                </span>
                <span className="flex shrink-0 gap-1.5">
                  {pdf && docx ? (
                    (["pdf", "docx"] as Kind[]).map((k) => (
                      <button key={k} onClick={() => setView(k)} aria-pressed={shown.kind === k}
                        className={`rounded-btn border px-2.5 py-1 text-label font-semibold ${
                          shown.kind === k ? "border-autumn-deep bg-autumn-deep" : "border-secondary-edge bg-secondary hover:bg-hover"
                        }`}>
                        {KIND_LABEL[k]}
                      </button>
                    ))
                  ) : null}
                  <a href={shown.kind === "pdf" ? `/api/resumes/files/${shown.id}?inline=1` : `/api/resumes/files/${shown.id}/preview`}
                    target="_blank" className={small}>
                    Open full size
                  </a>
                </span>
              </div>
              {shown.kind === "docx" ? (
                <p className="shrink-0 px-1.5 pb-2 text-label font-medium opacity-85">
                  DOCX preview shows the content, not the exact layout. Upload the PDF for an exact preview.
                </p>
              ) : null}
              <iframe key={previewSrc} src={previewSrc!} title={`Preview of ${shown.fileName}`}
                className="min-h-0 w-full flex-1 rounded-row bg-white"
                {...(shown.kind === "docx" ? { sandbox: "" } : {})} />
            </>
          ) : (
            <p className="m-auto max-w-sm text-center text-item font-medium">
              {version
                ? `Nothing to preview for version ${version.label} yet. Upload its PDF or DOCX on the left.`
                : "Pick a resume version on the left to preview it here."}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
