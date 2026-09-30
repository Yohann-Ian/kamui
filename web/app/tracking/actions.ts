"use server";

// Adding a job by hand (from LinkedIn or any job page) straight into Tracking.
// It becomes an ordinary Job row in a Battlefield with an Application at the
// chosen stage, so Discovery, Stats and Rank treat it like any searched job.

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "../../lib/prisma";

export type AddJobState = { error?: string; jobId?: string; message?: string };

const STAGES = ["Aim", "Applied", "Screening", "Interview", "Offer", "Rejected", "Dropped"];

// LinkedIn links come in several shapes; they all carry the numeric job id:
//   linkedin.com/jobs/view/4012345678/
//   linkedin.com/jobs/view/senior-engineer-at-acme-4012345678
//   linkedin.com/jobs/search/?currentJobId=4012345678&...
//   linkedin.com/jobs/collections/recommended/?currentJobId=4012345678
function linkedInId(url: URL) {
  if (!/(^|\.)linkedin\.com$/i.test(url.hostname)) return null;
  const fromParam = url.searchParams.get("currentJobId");
  if (fromParam && /^\d{6,}$/.test(fromParam)) return fromParam;
  return url.pathname.match(/\/jobs\/view\/(?:[^/]*?-)?(\d{6,})(?:\/|$)/)?.[1] ?? null;
}

// The posting's identity inside a Battlefield (dedup is on battlefieldId +
// atsJobId): the LinkedIn job id, else a hash of the link without its query.
function identify(raw: string) {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const id = linkedInId(url);
  if (id) {
    return { atsJobId: `linkedin:${id}`, source: "linkedin", url: `https://www.linkedin.com/jobs/view/${id}/` };
  }
  const key = `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`.toLowerCase();
  return {
    atsJobId: `manual:${createHash("sha1").update(key).digest("hex").slice(0, 16)}`,
    source: "manual",
    url: url.toString(),
  };
}

const text = (formData: FormData, key: string, max: number) =>
  String(formData.get(key) ?? "").trim().slice(0, max);

export async function addManualJob(_prev: AddJobState, formData: FormData): Promise<AddJobState> {
  const link = identify(text(formData, "url", 2000));
  const title = text(formData, "title", 300);
  const company = text(formData, "company", 200);
  const location = text(formData, "location", 200) || null;
  const description = text(formData, "description", 100_000) || null;
  const note = text(formData, "note", 10_000);
  const stage = text(formData, "stage", 40);
  const battlefieldId = text(formData, "battlefieldId", 100);

  if (!link) return { error: "Paste the job's link (starting with https://)." };
  if (!title || !company) return { error: "Add the job title and the company." };
  if (!STAGES.includes(stage)) return { error: "Pick a stage." };
  const battlefield = await prisma.battlefield.findUnique({ where: { id: battlefieldId } });
  if (!battlefield) return { error: "Pick a Battlefield." };

  // Already in this Battlefield (found by a search, or added before): track it
  // at the chosen stage rather than adding it twice.
  const existing = await prisma.job.findUnique({
    where: { battlefieldId_atsJobId: { battlefieldId, atsJobId: link.atsJobId } },
  });

  const job = existing
    ? await prisma.job.update({
        where: { id: existing.id },
        data: { dismissed: false, lastSeenAt: new Date(), ...(description && !existing.description ? { description } : {}) },
      })
    : await prisma.job.create({
        data: {
          battlefieldId,
          atsJobId: link.atsJobId,
          source: link.source,
          url: link.url,
          title,
          company,
          location,
          locationBin: location,
          description,
          raw: { addedByHand: true, source: link.source, location },
        },
      });

  await prisma.application.upsert({
    where: { jobId: job.id },
    create: { jobId: job.id, status: stage },
    update: { status: stage },
  });
  if (note) {
    await prisma.statusNote.upsert({
      where: { jobId_stage: { jobId: job.id, stage } },
      create: { jobId: job.id, stage, note },
      update: { note },
    });
  }

  revalidatePath("/", "layout");
  return {
    jobId: job.id,
    message: existing
      ? `Already in ${battlefield.name}; now tracked at ${stage}.`
      : `Added to ${battlefield.name} at ${stage}.`,
  };
}
