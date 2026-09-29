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

// Resumes live inside a Battlefield, which is the top of the hierarchy: the
// page is always scoped to one (?battlefield=<slug>), and a resume can never be
// moved to another Battlefield.
async function resumesUrl(battlefieldId: string | null, extra = "") {
  const bf = battlefieldId
    ? await prisma.battlefield.findUnique({ where: { id: battlefieldId }, select: { slug: true } })
    : null;
  return bf ? `/resumes?battlefield=${bf.slug}${extra}` : "/resumes";
}

// A new resume is created inside the selected Battlefield and starts with an
// empty version A, ready for its files.
export async function createResume(_prev: ResumeFormState, formData: FormData): Promise<ResumeFormState> {
  await requireResumesUnlocked();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the resume a name." };
  const battlefieldId = trackId(formData.get("battlefieldId"));
  const battlefield = battlefieldId
    ? await prisma.battlefield.findUnique({ where: { id: battlefieldId }, select: { id: true } })
    : null;
  if (!battlefield) return { error: "Pick a Battlefield first." };
  const resume = await prisma.resume.create({
    data: { name, battlefieldId: battlefield.id, versions: { create: { label: "A" } } },
    include: { versions: true },
  });
  revalidatePath("/resumes");
  redirect(await resumesUrl(resume.battlefieldId, `&version=${resume.versions[0].id}`));
}

// Rename only: a resume's Battlefield cannot be changed.
export async function renameResume(resumeId: string, name: string) {
  await requireResumesUnlocked();
  const clean = name.trim();
  if (!clean) return;
  await prisma.resume.update({ where: { id: resumeId }, data: { name: clean } });
  revalidatePath("/resumes");
}

// The next letter after the resume's existing versions
export async function addVersion(resumeId: string) {
  await requireResumesUnlocked();
  const existing = await prisma.resumeVersion.findMany({ where: { resumeId }, select: { label: true } });
  const version = await prisma.resumeVersion.create({
    data: { resumeId, label: nextVersionLabel(existing.map((v) => v.label)) },
    include: { resume: { select: { battlefieldId: true } } },
  });
  revalidatePath("/resumes");
  redirect(await resumesUrl(version.resume.battlefieldId, `&version=${version.id}`));
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
  const version = await prisma.resumeVersion.delete({
    where: { id: versionId },
    include: { resume: { select: { battlefieldId: true } } },
  });
  const left = await prisma.resumeVersion.findFirst({
    where: { resumeId: version.resumeId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!left) await prisma.resume.delete({ where: { id: version.resumeId } });
  revalidatePath("/resumes");
  redirect(await resumesUrl(version.resume.battlefieldId, left ? `&version=${left.id}` : ""));
}

export async function deleteResume(resumeId: string) {
  await requireResumesUnlocked();
  const resume = await prisma.resume.delete({ where: { id: resumeId } });
  revalidatePath("/resumes");
  redirect(await resumesUrl(resume.battlefieldId));
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
