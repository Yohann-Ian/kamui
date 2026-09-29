"use client";

// Resumes: Battlefield > resume > version, top to bottom in a compact column,
// then the selected version's notes and files. The rest of the screen previews
// the selected version. Everything stays inside the selected Battlefield, and a
// resume cannot be moved to another Battlefield.

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addVersion,
  changePasswordAction,
  createResume,
  deleteResume,
  deleteVersion,
  lockAction,
  removeFile,
  renameResume,
  saveVersionNotes,
} from "./actions";
import { CardLabel, btnPrimary, btnSecondary, field } from "../shell/ui";

type Kind = "pdf" | "docx";
type ResumeFile = { id: string; kind: Kind; fileName: string; size: number; uploadedOn: string; stamp: number };
type Version = { id: string; label: string; notes: string; createdOn: string; files: ResumeFile[] };
type Resume = { id: string; name: string; versions: Version[] };
type Battlefield = { id: string; slug: string; name: string; count: number };

const KIND_LABEL: Record<Kind, string> = { pdf: "PDF", docx: "DOCX" };
const ACCEPT: Record<Kind, string> = {
  pdf: ".pdf,application/pdf",
  docx: ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
const errorMark = "font-semibold underline decoration-grade-unfit decoration-2 underline-offset-4";
const small = "rounded-btn border border-secondary-edge bg-secondary px-2.5 py-1 text-label font-semibold hover:bg-hover";
const chip = (on: boolean) =>
  `min-w-8 rounded-btn border px-2 py-1 text-center font-mono text-label font-semibold ${
    on ? "border-autumn-deep bg-autumn-deep" : "border-secondary-edge bg-secondary hover:bg-hover"
  }`;
const row = (on: boolean) =>
  `flex items-center justify-between gap-2 rounded-row border-l-2 px-2.5 py-1.5 ${
    on ? "border-autumn-light bg-bf-active" : "border-transparent hover:bg-row-selected"
  }`;

const size = (n: number) =>
  n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

function NewResume({ battlefield, onDone }: { battlefield: Battlefield; onDone?: () => void }) {
  const [state, action, pending] = useActionState(createResume, {});
  return (
    <form action={action} className="mt-1 mb-1.5 space-y-2 rounded-row bg-row-selected p-2.5">
      <input type="hidden" name="battlefieldId" value={battlefield.id} />
      <input name="name" autoFocus placeholder={`Name, e.g. ${battlefield.name} resume`} aria-label="Resume name"
        className={`${field} w-full placeholder:text-white placeholder:opacity-80`} />
      <div className="flex flex-wrap items-center gap-2">
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

// Only on the unlocked page: set a new Resumes password
function ChangePassword({ onDone }: { onDone: () => void }) {
  const [state, action, pending] = useActionState(changePasswordAction, {});
  return (
    <form action={action} className="glass-card mt-3 flex flex-wrap items-center gap-2 px-3.5 py-3">
      <CardLabel className="w-full">New password</CardLabel>
      <input name="password" type="password" placeholder="New password" aria-label="New password"
        autoComplete="new-password" className={`${field} w-56 placeholder:text-white placeholder:opacity-80`} />
      <input name="confirm" type="password" placeholder="Type it again" aria-label="Confirm new password"
        autoComplete="new-password" className={`${field} w-56 placeholder:text-white placeholder:opacity-80`} />
      <button type="submit" disabled={pending} className={`${btnPrimary} py-1.5`}>
        {pending ? "Saving..." : "Save password"}
      </button>
      <button type="button" onClick={onDone} className={`${btnSecondary} py-1.5`}>
        {state.saved ? "Close" : "Cancel"}
      </button>
      {state.error ? <span className={`text-meta ${errorMark}`}>{state.error}</span> : null}
      {state.saved ? (
        <span className="text-meta font-medium">Password changed. Other devices will need the new one.</span>
      ) : null}
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
        {file ? <a href={`/api/resumes/files/${file.id}`} className={small}>Download</a> : null}
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
  battlefields,
  battlefieldId,
  resumes,
  selectedResumeId,
  selectedVersionId,
}: {
  battlefields: Battlefield[];
  battlefieldId: string | null;
  resumes: Resume[];
  selectedResumeId: string | null;
  selectedVersionId: string | null;
}) {
  const [creating, setCreating] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [notesState, setNotesState] = useState<"idle" | "saving" | "saved">("idle");
  const [pending, startTransition] = useTransition();

  const battlefield = battlefields.find((b) => b.id === battlefieldId) ?? null;
  const resume = resumes.find((r) => r.id === selectedResumeId) ?? null;
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

  const base = battlefield ? `/resumes?battlefield=${battlefield.slug}` : "/resumes";
  const total = battlefields.reduce((n, b) => n + b.count, 0);

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 px-6 pt-6">
      <div className="shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-heading font-bold tracking-[-0.015em]">Resumes</h1>
            <p className="mt-1 text-item font-medium">
              {total} {total === 1 ? "resume" : "resumes"} across {battlefields.length}{" "}
              {battlefields.length === 1 ? "Battlefield" : "Battlefields"}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button onClick={() => setChangingPassword((v) => !v)} className={btnSecondary}>
              Change password
            </button>
            <button onClick={() => startTransition(() => lockAction())} className={btnSecondary}>
              Lock
            </button>
          </div>
        </div>
        {changingPassword ? <ChangePassword onDone={() => setChangingPassword(false)} /> : null}
      </div>

      <div className="flex min-h-0 flex-1 gap-4 pb-4">
        {/* Battlefield > resume > version, kept narrow so the preview gets the screen */}
        <div className="panel-scroll flex w-[20rem] shrink-0 flex-col gap-3 overflow-y-auto pr-1">
          {/* 1. Battlefield */}
          <div className="glass-card px-3 py-3">
            <CardLabel className="px-1 pb-1.5">1. Battlefield</CardLabel>
            {battlefields.length === 0 ? (
              <p className="px-1 text-meta font-medium">No Battlefields yet. Create one first.</p>
            ) : (
              battlefields.map((b) => (
                <Link key={b.id} href={`/resumes?battlefield=${b.slug}`} className={row(b.id === battlefieldId)}>
                  <span className="truncate text-item font-medium">{b.name}</span>
                  <span className="shrink-0 font-mono text-count" title="resumes">{b.count}</span>
                </Link>
              ))
            )}
          </div>

          {/* 2. Resumes in that Battlefield */}
          {battlefield ? (
            <div className="glass-card px-3 py-3">
              <div className="flex items-center justify-between px-1 pb-1.5">
                <CardLabel>2. Resume</CardLabel>
                {!creating && resumes.length ? (
                  <button onClick={() => setCreating(true)} className={small}>+ New resume</button>
                ) : null}
              </div>
              {creating || resumes.length === 0 ? (
                <NewResume battlefield={battlefield} onDone={resumes.length ? () => setCreating(false) : undefined} />
              ) : null}
              {resumes.map((r) => (
                <Link key={r.id} href={`${base}&resume=${r.id}`} className={row(r.id === resume?.id)}>
                  <span className="truncate text-item font-medium" title={r.name}>{r.name}</span>
                  <span className="shrink-0 text-label font-medium opacity-85">
                    {r.versions.length} {r.versions.length === 1 ? "version" : "versions"}
                  </span>
                </Link>
              ))}
            </div>
          ) : null}

          {/* 3. Version of that resume, with + New in the same row */}
          {resume ? (
            <div className="glass-card px-3.5 py-3">
              <CardLabel className="pb-1.5">3. Version</CardLabel>
              <div className="flex flex-wrap gap-1.5">
                {resume.versions.map((v) => (
                  <Link key={v.id} href={`${base}&version=${v.id}`} className={chip(v.id === version?.id)}
                    title={`Version ${v.label}`} aria-current={v.id === version?.id}>
                    {v.label}
                  </Link>
                ))}
                <button disabled={pending} onClick={() => startTransition(() => addVersion(resume.id))}
                  className="rounded-btn border border-dashed border-dash px-2 py-1 text-label font-semibold hover:bg-row-selected"
                  title="Add the next version">
                  + New
                </button>
              </div>
              {!version ? (
                <p className="mt-2 text-meta font-medium">Pick a version to see and upload its files.</p>
              ) : null}
            </div>
          ) : battlefield && resumes.length ? (
            <p className="px-1 text-meta font-medium">Pick a resume to see its versions.</p>
          ) : null}

          {/* 4. The selected version: notes and files */}
          {resume && version ? (
            <div className="glass-card px-3.5 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <CardLabel>Version {version.label}</CardLabel>
                <span className="text-label font-medium opacity-85">{version.createdOn}</span>
              </div>

              <label htmlFor="notes" className="mt-2.5 flex items-baseline justify-between">
                <span className="text-meta font-semibold">What is different</span>
                <span className="text-label font-medium opacity-85">
                  {notesState === "saving" ? "saving..." : notesState === "saved" ? "saved" : ""}
                </span>
              </label>
              <textarea id="notes" defaultValue={version.notes} rows={4}
                placeholder="The subtle nuances of this version: what it emphasises, where you sent it..."
                onChange={() => setNotesState("idle")}
                onBlur={(e) => {
                  if (e.target.value === version.notes) return;
                  setNotesState("saving");
                  saveVersionNotes(version.id, e.target.value).then(() => setNotesState("saved"));
                }}
                className={`${field} mt-1.5 w-full resize-y leading-[1.5] placeholder:text-white placeholder:opacity-80`} />

              <div className="mt-3 text-meta font-semibold">Files</div>
              <ul className="mt-0.5">
                <Slot versionId={version.id} kind="pdf" file={pdf} />
                <Slot versionId={version.id} kind="docx" file={docx} />
              </ul>

              <div className="mt-3 border-t border-divider pt-2.5">
                <label htmlFor="resume-name" className="text-label font-semibold opacity-85">Resume name</label>
                <input id="resume-name" key={`name-${resume.id}`} defaultValue={resume.name}
                  onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== resume.name &&
                    startTransition(() => renameResume(resume.id, e.target.value))}
                  className={`${field} mt-1 w-full`} />
                <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-label font-semibold">
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
            </div>
          ) : null}
        </div>

        {/* the preview gets everything else */}
        <div className="glass-card flex min-w-0 flex-1 flex-col p-2.5">
          {shown && version && resume ? (
            <>
              <div className="flex shrink-0 items-center justify-between gap-3 px-1.5 pb-2">
                <span className="truncate text-meta font-semibold">
                  {battlefield?.name} · {resume.name} · Version {version.label} · {shown.fileName}
                </span>
                <span className="flex shrink-0 gap-1.5">
                  {pdf && docx ? (
                    (["pdf", "docx"] as Kind[]).map((k) => (
                      <button key={k} onClick={() => setView(k)} aria-pressed={shown.kind === k} className={chip(shown.kind === k)}>
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
              {!battlefield
                ? "Create a Battlefield first; resumes live inside Battlefields."
                : !resume
                  ? `Pick a ${battlefield.name} resume on the left.`
                  : !version
                    ? `Pick a version of ${resume.name} to preview it.`
                    : `Nothing to preview for version ${version.label} yet. Upload its PDF or DOCX on the left.`}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
