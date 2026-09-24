// Starts the career-site search actor on Apify and reads its results later.
// Searches never wait for Apify inside a request: startSearch returns the run
// ids straight away, and the status route (lib/searchRuns.ts) checks them.
// The actor takes a single location string, so each location is its own run.
import { ApifyClient } from "apify-client";

const ACTOR_ID = "jharney/career-site-jobs-api";
export const TERMINAL = ["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"];

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

export type ActorJob = {
  jobId?: string | number;
  ats?: string;
  company?: string;
  title?: string;
  location?: string;
  url?: string;
  descriptionText?: string;
  [key: string]: unknown;
};

export type SearchParams = {
  query?: string; // all words must appear in the title (Explore)
  titleIncludes?: string[]; // title must contain one of these (Battlefields)
  titleExcludes?: string[];
  maxBoards: number;
  maxJobs: number;
  maxJobsPerBoard: number;
};

// Starts one actor run per location. Returns the ids of the runs that started
// (they are being paid for, so they must be recorded) and any start errors.
export async function startSearch(params: SearchParams, locations: string[]) {
  const results = await Promise.allSettled(
    (locations.length ? locations : [""]).map((location) =>
      client
        .actor(ACTOR_ID)
        .start({ mode: "search", includeDescription: true, location, ...params })
    )
  );
  return {
    ids: results.flatMap((r) => (r.status === "fulfilled" ? [r.value.id] : [])),
    errors: results.flatMap((r) => (r.status === "rejected" ? [String(r.reason)] : [])),
  };
}

export type RunState = {
  id: string;
  status: string;
  statusMessage: string | null;
  datasetId: string | null;
};

export async function getRuns(ids: string[]): Promise<RunState[]> {
  return Promise.all(
    ids.map(async (id) => {
      const run = await client.run(id).get();
      return {
        id,
        status: run?.status ?? "MISSING",
        statusMessage: run?.statusMessage ?? null,
        datasetId: run?.defaultDatasetId ?? null,
      };
    })
  );
}

// All items from the given datasets, merged and de-duplicated by ATS job id.
export async function readJobs(datasetIds: string[]) {
  const lists = await Promise.all(
    datasetIds.map(async (id) => (await client.dataset<ActorJob>(id).listItems({ clean: true })).items)
  );
  const byId = new Map<string, ActorJob>();
  for (const job of lists.flat()) {
    if (job.jobId == null) continue;
    byId.set(String(job.jobId), job);
  }
  return [...byId.values()];
}
