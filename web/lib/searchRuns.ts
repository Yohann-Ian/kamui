// Searches run in two steps so no request waits for Apify:
// 1. start*: create the Run row, start the Apify runs, store their ids, return.
// 2. checkRun (polled by the status route): while any Apify run is still going,
//    report progress; once all have finished, ingest the results exactly once
//    and mark the Run done (or failed).
import { prisma } from "./prisma";
import { getRuns, readJobs, startSearch, TERMINAL, type RunState, type SearchParams } from "./apify";
import { APPLIED_STAGES, saveToBattlefield, toJobData } from "./jobs";
import { HttpError } from "./http";
import type { Battlefield, Run } from "../generated/prisma/client";

export const ACTIVE = ["running", "ingesting"];

// Explore searches are deliberately small; a wave can be promoted into a
// Battlefield with bigger caps later.
const EXPLORE_CAPS = { maxBoards: 500, maxJobs: 50, maxJobsPerBoard: 10 };

async function launch(runId: string, params: SearchParams, locations: string[]) {
  const { ids, errors } = await startSearch(params, locations);
  if (ids.length === 0) {
    await prisma.run.update({
      where: { id: runId },
      data: { status: "failed", error: errors.join("; ") || "No Apify run started", finishedAt: new Date() },
    });
    throw new Error(`Could not start the search: ${errors[0] ?? "no Apify run started"}`);
  }
  return prisma.run.update({
    where: { id: runId },
    data: {
      apifyRunIds: ids,
      error: errors.length ? `${errors.length} location(s) failed to start: ${errors[0]}` : null,
    },
  });
}

// One search per Battlefield at a time: a second click returns the running one.
export async function startBattlefieldSearch(battlefield: Battlefield) {
  const active = await prisma.run.findFirst({
    where: { battlefieldId: battlefield.id, kind: "search", status: { in: ACTIVE } },
    orderBy: { startedAt: "desc" },
  });
  if (active) return { run: active, alreadyRunning: true };

  const run = await prisma.run.create({ data: { battlefieldId: battlefield.id, kind: "search" } });
  const launched = await launch(
    run.id,
    {
      titleIncludes: battlefield.titleIncludes,
      titleExcludes: battlefield.titleExcludes,
      maxBoards: battlefield.maxBoards,
      maxJobs: battlefield.maxJobs,
      maxJobsPerBoard: battlefield.maxJobsPerBoard,
    },
    battlefield.locations
  );
  return { run: launched, alreadyRunning: false };
}

// The wave exists from the start so the holding bay can show it while it runs.
export async function startExplore(query: string, locations: string[]) {
  const wave = await prisma.searchWave.create({ data: { query, locations } });
  const run = await prisma.run.create({ data: { kind: "search", searchWaveId: wave.id } });
  const launched = await launch(run.id, { query, ...EXPLORE_CAPS }, locations);
  return { run: launched, wave };
}

async function ingest(run: Run, states: RunState[]) {
  // Claim the Run so two pollers can never ingest the same results twice.
  const claimed = await prisma.run.updateMany({
    where: { id: run.id, status: "running" },
    data: { status: "ingesting" },
  });
  if (claimed.count === 0) return { run: await prisma.run.findUniqueOrThrow({ where: { id: run.id } }), newJobIds: [] };

  const ok = states.filter((s) => s.status === "SUCCEEDED" && s.datasetId);
  const bad = states.filter((s) => s.status !== "SUCCEEDED");
  const problems = [
    run.error,
    bad.length ? `${bad.length} of ${states.length} Apify runs ended ${bad.map((s) => s.status).join(", ")}` : null,
  ].filter(Boolean);
  const error = problems.length ? problems.join("; ") : null;
  const finish = (data: Partial<Run>) =>
    prisma.run.update({ where: { id: run.id }, data: { ...data, finishedAt: new Date() } });

  try {
    if (ok.length === 0 && states.length > 0) {
      return { run: await finish({ status: "failed", error }), newJobIds: [] };
    }
    const jobs = (await readJobs(ok.map((s) => s.datasetId!))).map(toJobData);

    let newJobIds: string[] = [];
    if (run.battlefieldId) {
      newJobIds = (await saveToBattlefield(run.battlefieldId, jobs)).newJobIds;
    } else if (run.searchWaveId) {
      await prisma.$transaction([
        prisma.job.createMany({ data: jobs.map((j) => ({ ...j, searchWaveId: run.searchWaveId })) }),
        prisma.searchWave.update({ where: { id: run.searchWaveId }, data: { jobCount: jobs.length } }),
      ]);
    }
    const updated = await finish({
      status: "done",
      jobsFound: jobs.length,
      jobsNew: run.battlefieldId ? newJobIds.length : jobs.length,
      error,
    });
    return { run: updated, newJobIds };
  } catch (e) {
    return { run: await finish({ status: "failed", error: String(e) }), newJobIds: [] };
  }
}

async function summarize(run: Run, states: RunState[]) {
  // Jobs this search found were inserted or had lastSeenAt bumped after it started
  const alreadyApplied =
    run.battlefieldId && run.status === "done"
      ? await prisma.job.count({
          where: {
            battlefieldId: run.battlefieldId,
            lastSeenAt: { gte: run.startedAt },
            application: { status: { in: APPLIED_STAGES } },
          },
        })
      : 0;
  return {
    runId: run.id,
    kind: run.kind,
    status: run.status,
    battlefieldId: run.battlefieldId,
    searchWaveId: run.searchWaveId,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    progress: states.map((s) => s.statusMessage).filter((m): m is string => !!m),
    found: run.jobsFound,
    new: run.jobsNew,
    alreadyApplied,
    error: run.error,
  };
}

// Checks a Run, ingesting its results if every Apify run has finished.
// newJobIds is non-empty only on the call that did the ingesting.
export async function checkRun(runId: string) {
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) throw new HttpError(404, "No such run");
  if (run.kind !== "search" || run.status !== "running") {
    return { summary: await summarize(run, []), newJobIds: [] };
  }

  const states = await getRuns(run.apifyRunIds);
  const finished = states.every((s) => TERMINAL.includes(s.status) || s.status === "MISSING");
  if (!finished) return { summary: await summarize(run, states), newJobIds: [] };

  const result = await ingest(run, states);
  return { summary: await summarize(result.run, []), newJobIds: result.newJobIds };
}
