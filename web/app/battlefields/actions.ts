"use server";

import { prisma } from "../../lib/prisma";
import { uniqueSlug } from "../../lib/battlefields";
import { copyWaveJobs } from "../../lib/waves";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type FormState = { error?: string; saved?: string };

// One entry per line; blank lines dropped.
function lines(formData: FormData, key: string) {
  return String(formData.get(key) ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function cap(formData: FormData, key: string) {
  const n = Number(formData.get(key));
  return Number.isInteger(n) && n > 0 ? n : null;
}

function readSearchFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const titleIncludes = lines(formData, "titleIncludes");
  const maxBoards = cap(formData, "maxBoards");
  const maxJobs = cap(formData, "maxJobs");
  const maxJobsPerBoard = cap(formData, "maxJobsPerBoard");

  if (!name) return { error: "Give the Battlefield a name." };
  if (titleIncludes.length === 0) return { error: "Add at least one title keyword." };
  if (!maxBoards || !maxJobs || !maxJobsPerBoard) {
    return { error: "The three caps must be whole numbers above zero." };
  }
  return {
    data: {
      name,
      titleIncludes,
      titleExcludes: lines(formData, "titleExcludes"),
      locations: lines(formData, "locations"),
      maxBoards,
      maxJobs,
      maxJobsPerBoard,
    },
  };
}

export async function createBattlefield(_prev: FormState, formData: FormData): Promise<FormState> {
  const fields = readSearchFields(formData);
  if (!fields.data) return { error: fields.error };
  const slug = await uniqueSlug(fields.data.name);
  const battlefield = await prisma.battlefield.create({ data: { ...fields.data, slug } });
  // Created from an Explore wave: seed it with that wave's jobs, unranked
  const fromWave = String(formData.get("fromWave") ?? "");
  if (fromWave) await copyWaveJobs(fromWave, battlefield.id);
  revalidatePath("/", "layout");
  redirect(`/battlefields/${slug}`);
}

export async function updateBattlefield(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const fields = readSearchFields(formData);
  if (!fields.data) return { error: fields.error };
  await prisma.battlefield.update({ where: { id }, data: fields.data });
  revalidatePath("/", "layout");
  return { saved: "Saved." };
}

export async function setAutomation(id: string, field: "autoPopulate" | "autoRank", on: boolean) {
  await prisma.battlefield.update({ where: { id }, data: { [field]: on } });
  revalidatePath("/", "layout");
}

// Never overwrites: inserts the next version, activates it, deactivates the rest.
export async function saveRubric(battlefieldId: string, body: string): Promise<FormState> {
  const text = body.trim();
  if (!text) return { error: "The rubric is empty." };

  const active = await prisma.rubric.findFirst({ where: { battlefieldId, active: true } });
  if (active && active.body.trim() === text) return { error: "No changes to save." };

  const latest = await prisma.rubric.findFirst({
    where: { battlefieldId },
    orderBy: { version: "desc" },
  });
  const version = latest ? latest.version + 1 : 0;
  await prisma.$transaction([
    prisma.rubric.updateMany({ where: { battlefieldId }, data: { active: false } }),
    prisma.rubric.create({ data: { battlefieldId, version, active: true, body: text } }),
  ]);
  revalidatePath("/", "layout");
  return { saved: `Saved as v${version}.` };
}

export async function setArchived(id: string, archived: boolean) {
  const battlefield = await prisma.battlefield.update({ where: { id }, data: { archived } });
  revalidatePath("/", "layout");
  redirect(archived ? "/" : `/battlefields/${battlefield.slug}`);
}

// Opening a Battlefield's Discovery: jobs first seen after this stop counting
// as "new" on the homepage. No revalidation, so the open page does not reload.
export async function markViewed(battlefieldId: string) {
  await prisma.battlefield.update({ where: { id: battlefieldId }, data: { lastViewedAt: new Date() } });
}
