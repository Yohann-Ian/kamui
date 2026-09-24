// Runs the career-site search actor on Apify and returns its job items.
// Port of worker/fetch.py. The actor takes a single location string, so a
// search across several locations runs the actor once per location.

const API = "https://api.apify.com/v2";
const ACTOR_ID = "jharney~career-site-jobs-api";
const TERMINAL = ["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"];

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

async function apify(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.APIFY_TOKEN}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Apify ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return res.json();
}

async function runActor(params: SearchParams, location: string): Promise<ActorJob[]> {
  const input = { mode: "search", includeDescription: true, location, ...params };
  const started = await apify(`/acts/${ACTOR_ID}/runs`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  let { status } = started.data;
  const { id, defaultDatasetId } = started.data;

  // waitForFinish holds each poll open for up to 60s, so this is not a busy loop
  while (!TERMINAL.includes(status)) {
    const polled = await apify(`/actor-runs/${id}?waitForFinish=60`);
    status = polled.data.status;
  }
  if (status !== "SUCCEEDED") {
    throw new Error(`Apify run ${id} ended with status ${status}`);
  }
  return apify(`/datasets/${defaultDatasetId}/items?clean=true`);
}

// One actor run per location, merged and de-duplicated by ATS job id.
export async function searchJobs(params: SearchParams, locations: string[]) {
  const runs = await Promise.all(
    (locations.length ? locations : [""]).map((loc) => runActor(params, loc))
  );
  const byId = new Map<string, ActorJob>();
  for (const job of runs.flat()) {
    if (job.jobId == null) continue;
    byId.set(String(job.jobId), job);
  }
  return [...byId.values()];
}
