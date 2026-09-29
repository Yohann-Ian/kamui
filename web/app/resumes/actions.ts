"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "../../lib/prisma";
import { nextVersionLabel } from "../../lib/resumes";
import {
  MIN_PASSWORD_LENGTH,
  changeResumesPassword,
  lockResumes,
  requireResumesUnlocked,
  unlockResumes,
} from "../../lib/resumeLock";

export type ResumeFormState = { error?: string };

const trackId = (v: FormDataEntryValue | null) => (typeof v === "string" && v ? v : null);

// A new resume starts with an empty version A, ready for its files.
export async function createResume(_prev: ResumeFormState, formData: FormData): Promise<ResumeFormState> {
  await requireResumesUnlocked();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the resume a name." };
  const resume = await prisma.resume.create({
    data: {
      name,
      battlefieldId: trackId(formData.get("battlefieldId")),
      versions: { create: { label: "A" } },
    },
    include: { versions: true },
  });
  revalidatePath("/resumes");
  redirect(`/resumes?version=${resume.versions[0].id}`);
}

export async function updateResume(resumeId: string, name: string, battlefieldId: string | null) {
  await requireResumesUnlocked();
  const clean = name.trim();
  await prisma.resume.update({
    where: { id: resumeId },
    data: { ...(clean ? { name: clean } : {}), battlefieldId: battlefieldId || null },
  });
  revalidatePath("/resumes");
}

// The next letter after the resume's existing versions
export async function addVersion(resumeId: string) {
  await requireResumesUnlocked();
  const existing = await prisma.resumeVersion.findMany({ where: { resumeId }, select: { label: true } });
  const version = await prisma.resumeVersion.create({
    data: { resumeId, label: nextVersionLabel(existing.map((v) => v.label)) },
  });
  revalidatePath("/resumes");
  redirect(`/resumes?version=${version.id}`);
}

export async function saveVersionNotes(versionId: string, notes: string) {
  await requireResumesUnlocked();
  await prisma.resumeVersion.update({ where: { id: versionId }, data: { notes } });
  revalidatePath("/resumes");
}

export async function removeFile(fileId: string) {
  await requireResumesUnlocked();
  await prisma.resumeFile.delete({ where: { id: fileId } });
  revalidatePath("/resumes");
}

// Deleting a resume's last version deletes the resume too.
export async function deleteVersion(versionId: string) {
  await requireResumesUnlocked();
  const version = await prisma.resumeVersion.delete({ where: { id: versionId } });
  const left = await prisma.resumeVersion.count({ where: { resumeId: version.resumeId } });
  if (left === 0) await prisma.resume.delete({ where: { id: version.resumeId } });
  revalidatePath("/resumes");
  redirect("/resumes");
}

export async function deleteResume(resumeId: string) {
  await requireResumesUnlocked();
  await prisma.resume.delete({ where: { id: resumeId } });
  revalidatePath("/resumes");
  redirect("/resumes");
}

// The lock screen's form
export async function unlockAction(_prev: ResumeFormState, formData: FormData): Promise<ResumeFormState> {
  const error = await unlockResumes(String(formData.get("password") ?? ""));
  if (error) return { error };
  redirect("/resumes");
}

export async function lockAction() {
  await lockResumes();
  redirect("/resumes");
}

// Only reachable from the unlocked page; changeResumesPassword checks again.
export async function changePasswordAction(
  _prev: ResumeFormState & { saved?: boolean },
  formData: FormData
): Promise<ResumeFormState & { saved?: boolean }> {
  const password = String(formData.get("password") ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password !== String(formData.get("confirm") ?? "")) return { error: "The two passwords differ." };
  await changeResumesPassword(password);
  return { saved: true };
}
