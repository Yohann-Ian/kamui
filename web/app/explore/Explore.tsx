"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { elapsedSince, isActive, useNow, useRunStatus } from "../useRunStatus";

type Wave = {
  id: string;
  query: string;
  locations: string[];
  when: string;
  jobCount: number;
  runId: string | null;
  runStatus: string;
  runError: string | null;
};

const searchingNow = (w: Wave) => w.runStatus === "running" || w.runStatus === "ingesting";
type Job = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  url: string;
  description: string | null;
};
type Battlefield = { id: string; slug: string; name: string };

const button =
  "rounded-md border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50";
const heading = "mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400";

async function call(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

function SearchForm() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [locations, setLocations] = useState("United States");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Starts the search and opens its wave straight away; the wave shows the
  // progress while Apify runs.
  async function search(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { waveId } = await call("/api/explore", {
        query,
        locations: locations.split("\n").map((l) => l.trim()).filter(Boolean),
      });
      router.push(`/explore?wave=${waveId}`);
      router.refresh();
    } catch (err) {
      setError(`Search failed to start: ${errorText(err)}`);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={search} className="mb-8 rounded-lg border border-gray-200 p-4">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className={heading} htmlFor="query">
            Keywords
          </label>
          <input
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. content marketing manager"
            className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm"
          />
          <p className="mt-1 text-xs text-gray-400">Every word must appear in the job title.</p>
        </div>
        <div className="w-56">
          <label className={heading} htmlFor="locations">
            Locations
          </label>
          <textarea
            id="locations"
            value={locations}
            onChange={(e) => setLocations(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm"
          />
          <p className="mt-1 text-xs text-gray-400">One per line. Each is a separate search.</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy || !query.trim()}
          className={`${button} border-gray-900 bg-gray-900 text-white`}
        >
          {busy ? "Starting..." : "Search"}
        </button>
        <span className="text-xs text-gray-400">
          Costs Apify credits: up to 50 jobs per location, from 500 career sites. The results are
          saved, so reopening them later is free.
        </span>
        {error ? <span className="text-sm text-red-700">{error}</span> : null}
      </div>
    </form>
  );
}

// Shown on a wave whose search is still running on Apify.
function WaveProgress({ runId }: { runId: string }) {
  const router = useRouter();
  const run = useRunStatus(runId);
  const now = useNow(true);

  // When the search finishes, reload so the wave's jobs appear (once)
  const refreshed = useRef(false);
  useEffect(() => {
    if (run && !isActive(run) && !refreshed.current) {
      refreshed.current = true;
      router.refresh();
    }
  }, [run, router]);

  if (run?.status === "failed") {
    return <p className="mb-4 text-sm text-red-700">Search failed: {run.error}</p>;
  }
  return (
    <div className="mb-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
      <div className="tabular-nums">
        {run?.status === "ingesting"
          ? "Saving the results..."
          : `Searching... ${run && now ? `${elapsedSince(run.startedAt, now)} - ` : ""}${
              run?.progress.join(" / ") || "starting up"
            }`}
      </div>
      <p className="mt-1 text-xs text-gray-400">
        The search runs on Apify, so you can leave this page; it is saved here when it finishes.
      </p>
    </div>
  );
}

function Promote({ wave, battlefields }: { wave: Wave; battlefields: Battlefield[] }) {
  const [target, setTarget] = useState(battlefields[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    { text: string; slug?: string; error?: boolean } | null
  >(null);

  async function send() {
    setBusy(true);
    setResult(null);
    try {
      const r = await call(`/api/explore/waves/${wave.id}/promote`, { battlefieldId: target });
      setResult({
        text: `Copied ${r.copied} into ${r.battlefield.name}${
          r.skipped ? `, ${r.skipped} ${r.skipped === 1 ? "was" : "were"} already there` : ""
        }. They are unranked.`,
        slug: r.battlefield.slug,
      });
    } catch (e) {
      setResult({ text: errorText(e), error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded-lg bg-gray-50 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-gray-600">Send these {wave.jobCount} jobs to</span>
        {battlefields.length ? (
          <>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="rounded border border-gray-200 bg-white px-1 py-0.5"
            >
              {battlefields.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <button
              onClick={send}
              disabled={busy || !target || wave.jobCount === 0}
              className={`${button} border-gray-300 bg-white text-gray-700 hover:border-gray-500`}
            >
              {busy ? "Sending..." : "Send"}
            </button>
            <span className="text-gray-400">or</span>
          </>
        ) : null}
        <Link
          href={`/battlefields/new?fromWave=${wave.id}`}
          className="text-gray-700 underline hover:text-gray-900"
        >
          start a new Battlefield from this search
        </Link>
      </div>
      {result ? (
        <p className={`mt-2 ${result.error ? "text-red-700" : "text-gray-700"}`}>
          {result.text}{" "}
          {result.slug ? (
            <Link href={`/?battlefield=${result.slug}`} className="underline">
              Open it
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

export default function Explore({
  waves,
  currentId,
  jobs,
  battlefields,
}: {
  waves: Wave[];
  currentId: string | null;
  jobs: Job[];
  battlefields: Battlefield[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const current = waves.find((w) => w.id === currentId) ?? null;

  return (
    <main className="mx-auto flex max-w-6xl gap-8 px-6 py-10">
      <aside className="w-60 shrink-0">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">
          &larr; Discovery
        </Link>
        <h2 className={`${heading} mt-6`}>Holding bay</h2>
        {waves.length === 0 ? (
          <p className="text-sm text-gray-400">No saved searches yet.</p>
        ) : (
          <ul className="space-y-1">
            {waves.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/explore?wave=${w.id}`}
                  className={`block rounded-md px-2 py-1.5 ${
                    w.id === currentId ? "bg-gray-900 text-white" : "hover:bg-gray-100"
                  }`}
                >
                  <div className="truncate text-sm">{w.query}</div>
                  <div
                    className={`text-[11px] ${w.id === currentId ? "text-gray-300" : "text-gray-400"}`}
                  >
                    {w.when} -{" "}
                    {searchingNow(w)
                      ? "searching..."
                      : w.runStatus === "failed"
                        ? "failed"
                        : `${w.jobCount} ${w.jobCount === 1 ? "job" : "jobs"}`}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="min-w-0 flex-1">
        <h1 className="mb-4 text-xl font-medium">Explore</h1>
        <SearchForm />

        {current ? (
          <>
            <div className="mb-3 border-b border-gray-200 pb-2">
              <div className="text-lg font-medium">&ldquo;{current.query}&rdquo;</div>
              <div className="text-xs text-gray-500">
                {current.when}
                {current.locations.length ? ` - ${current.locations.join(", ")}` : ""} -{" "}
                {searchingNow(current)
                  ? "searching"
                  : `${current.jobCount} ${current.jobCount === 1 ? "job" : "jobs"}, unranked`}
              </div>
            </div>

            {searchingNow(current) && current.runId ? (
              <WaveProgress runId={current.runId} />
            ) : current.runStatus === "failed" ? (
              <p className="mb-4 text-sm text-red-700">Search failed: {current.runError}</p>
            ) : (
              <Promote wave={current} battlefields={battlefields} />
            )}

            <ul>
              {jobs.map((job) => (
                <li key={job.id} className="border-b border-gray-100">
                  <div className="flex items-center gap-4 px-2 py-2.5 hover:bg-gray-50">
                    <button
                      onClick={() => setOpenId(openId === job.id ? null : job.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate text-[15px] font-medium leading-tight">
                        {job.title}
                      </div>
                      <div className="truncate text-[13px] leading-tight text-gray-500">
                        {job.company} - {job.location}
                      </div>
                    </button>
                    <a
                      href={job.url}
                      target="_blank"
                      className="shrink-0 text-xs text-gray-500 underline hover:text-gray-900"
                    >
                      Open posting
                    </a>
                  </div>
                  {openId === job.id ? (
                    <p className="whitespace-pre-wrap px-2 pb-4 text-[13px] leading-relaxed text-gray-600">
                      {job.description ?? "No description."}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
            {jobs.length === 0 && current.runStatus === "done" ? (
              <p className="py-6 text-sm text-gray-400">This search found no jobs.</p>
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  );
}
