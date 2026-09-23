"use server";

import { prisma } from "../lib/prisma";
import { revalidatePath } from "next/cache";

export async function setStatus(jobId: string, status: string) {
  await prisma.application.upsert({
    where: { jobId },
    create: { jobId, status },
    update: { status },
  });
  revalidatePath("/");
}

export async function saveNote(jobId: string, stage: string, note: string) {
  await prisma.statusNote.upsert({
    where: { jobId_stage: { jobId, stage } },
    create: { jobId, stage, note },
    update: { note },
  });
  revalidatePath("/");
}