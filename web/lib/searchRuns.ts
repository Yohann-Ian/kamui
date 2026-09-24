// Searches run in two steps so no request waits for Apify:
// 1. start*: create the Run row, start the Apify runs, store their ids, return.
// 2. checkRun (polled by the status route): while any Apify run is still going,
//    report progress; once all have finished, ingest the results exactly once
//    and mark the Run done (or failed).
import { after } from "next/server";
import { prisma } from "./prisma";
import { getRuns, readJobs, startSearch, TERMINAL, type RunState, type SearchParams } from "./apify";
import { rankBattlefield } from "./rank";
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

// While a Run is ingesting, its saver stamps heartbeatAt this often. The sweep
// treats a stamp older than STALE_AFTER_MS as a dead saver and retries the Run.
const HEARTBEAT_MS = 5_000;
const STALE_AFTER_MS = 2 * 60_000;

function startHeartbeat(runId: string) {
  const timer = setInterval(() => {
    prisma.run
      .updateMany({ where: { id: runId, status: "ingesting" }, data: { heartbeatAt: new Date() } })
      .catch((e) => console.error("heartbeat failed", runId, e));
  }, HEARTBEAT_MS);
  return () => clearInterval(timer);
}

// Hands Runs whose saver died mid-ingest back to "running" so they are retried.
// A slow save keeps stamping heartbeatAt and is never reclaimed. A Run ingesting
// with no stamp at all predates heartbeats, so it is treated as stale too.
export async function reclaimStaleIngests() {
  const { count } = await prisma.run.updateMany({
    where: {
      kind: "search",
      status: "ingesting",
      OR: [{ heartbeatAt: { lt: new Date(Date.now() - STALE_AFTER_MS) } }, { heartbeatAt: null }],
    },
    data: { status: "running" },
  });
  return count;
}

async function ingest(run: Run, states: RunState[]) {
  // Claim the Run so two pollers can never ingest the same results twice.
  const claimed = await prisma.run.updateMany({
    where: { id: run.id, status: "running" },
    data: { status: "ingesting", heartbeatAt: new Date() },
  });
  if (claimed.count === 0) return { run: await prisma.run.findUniqueOrThrow({ where: { id: run.id } }), newJobIds: [] };

  const stopHeartbeat = startHeartbeat(run.id);
  try {
    return await save(run, states);
  } finally {
    stopHeartbeat();
  }
}

async function save(run: Run, states: RunState[]) {
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
      // Replace rather than append, so a retried save after a crash that had
      // already committed cannot store the wave's jobs twice.
      await prisma.$transaction([
        prisma.job.deleteMany({ where: { searchWaveId: run.searchWaveId, battlefieldId: null } }),
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

// Auto-Rank grades only a search's new arrivals, after the response is sent,
// so ranking never holds a request open. It writes its own Run. Call from a
// route handler (after() needs the request scope).
export async function autoRankAfter(battlefieldId: string | null, newJobIds: string[]) {
  if (!battlefieldId || newJobIds.length === 0) return null;
  const battlefield = await prisma.battlefield.findUnique({ where: { id: battlefieldId } });
  if (!battlefield?.autoRank) return null;
  after(() =>
    rankBattlefield(battlefield.id, { jobIds: newJobIds }).catch((e) =>
      console.error("Auto-Rank failed", e)
    )
  );
  return "started" as const;
}

// Checks every running search and ingests the ones whose Apify runs have
// finished, so saving never depends on a browser polling. Uses checkRun, so
// the same claim guard applies if a browser polls the same Run at once. Runs
// whose saver died mid-ingest are reclaimed first, so they are retried here.
export async function sweepRunningSearches() {
  const reclaimed = await reclaimStaleIngests();
  const running = await prisma.run.findMany({
    where: { kind: "search", status: "running" },
    orderBy: { startedAt: "asc" },
    select: { id: true },
  });
  const results = [];
  for (const { id } of running) {
    try {
      const { summary, newJobIds } = await checkRun(id);
      const autoRank = await autoRankAfter(summary.battlefieldId, newJobIds);
      results.push({ runId: id, status: summary.status, found: summary.found, new: summary.new, autoRank });
    } catch (e) {
      results.push({ runId: id, status: "error", error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { reclaimed, results };
}
