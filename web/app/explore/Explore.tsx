"use client";

// Explore: one-off searches saved as waves. Same shell and patterns: a glass
// search card, then the holding bay (past waves) beside the open wave's jobs.
// Explore jobs are unranked, so their rows carry no score or grade.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { elapsedSince, isActive, useNow, useRunStatus } from "../useRunStatus";
import { CardLabel, btnDashed, btnPrimary, btnSecondary, field } from "../shell/ui";

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
type Job = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  url: string;
  description: string | null;
};
type Battlefield = { id: string; slug: string; name: string };

const searchingNow = (w: Wave) => w.runStatus === "running" || w.runStatus === "ingesting";
const errorMark = "font-semibold underline decoration-grade-unfit decoration-2 underline-offset-4";

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
    <form onSubmit={search} className="glass-card shrink-0 px-5 py-4">
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <label htmlFor="query">
            <CardLabel className="pb-1.5">Keywords</CardLabel>
          </label>
          <input
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. content marketing manager"
            className={`${field} w-full placeholder:text-white placeholder:opacity-80`}
          />
          <p className="mt-1 text-label font-medium opacity-85">Every word must appear in the job title.</p>
        </div>
        <div className="w-[15rem] shrink-0">
          <label htmlFor="locations">
            <CardLabel className="pb-1.5">Locations</CardLabel>
          </label>
          <textarea
            id="locations"
            value={locations}
            onChange={(e) => setLocations(e.target.value)}
            rows={2}
            className={`${field} w-full resize-none`}
          />
          <p className="mt-1 text-label font-medium opacity-85">One per line. Each is a separate search.</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy || !query.trim()} className={btnPrimary}>
          {busy ? "Starting..." : "Search"}
        </button>
        <span className="text-meta font-medium">
          Costs Apify credits: up to 50 jobs per location, from 500 career sites. Results are saved,
          so reopening them later is free.
        </span>
        {error ? <span className={`text-meta ${errorMark}`}>{error}</span> : null}
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
    return <p className={`text-item ${errorMark}`}>Search failed: {run.error}</p>;
  }
  return (
    <div className="glass-card px-[1.125rem] py-3.5 text-item">
      <div className="font-medium tabular-nums">
        {run?.status === "ingesting"
          ? "Saving the results..."
          : `Searching... ${run && now ? `${elapsedSince(run.startedAt, now)} - ` : ""}${
              run?.progress.join(" / ") || "starting up"
            }`}
      </div>
      <p className="mt-1 text-meta font-medium opacity-85">
        The search runs on Apify, so you can leave this page; it is saved here when it finishes.
      </p>
    </div>
  );
}

function Promote({ wave, battlefields }: { wave: Wave; battlefields: Battlefield[] }) {
  const [target, setTarget] = useState(battlefields[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ text: string; slug?: string; error?: boolean } | null>(null);

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
    <div className="glass-card px-[1.125rem] py-3.5 text-item">
      <div className="flex flex-wrap items-center gap-2">
        {battlefields.length ? (
          <>
            <span className="font-medium">
              Send these {wave.jobCount} {wave.jobCount === 1 ? "job" : "jobs"} to
            </span>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className={`${field} py-1`}
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
              className={`${btnSecondary} py-1.5`}
            >
              {busy ? "Sending..." : "Send"}
            </button>
            <span className="font-medium">or</span>
          </>
        ) : null}
        <Link href={`/battlefields/new?fromWave=${wave.id}`} className={`${btnDashed} py-1.5`}>
          Start a new Battlefield from this search
        </Link>
      </div>
      {result ? (
        <p className={`mt-2 ${result.error ? errorMark : "font-medium"}`}>
          {result.text}{" "}
          {result.slug ? (
            <Link href={`/battlefields/${result.slug}`} className="underline underline-offset-2">
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
    <section className="flex h-full min-h-0 flex-col gap-4 px-6 pt-6">
      <div className="shrink-0">
        <h1 className="font-display text-heading font-bold tracking-[-0.015em]">Explore</h1>
        <p className="mt-1 text-item font-medium">
          One-off searches, saved in the holding bay. Nothing is ranked here.
        </p>
      </div>

      <SearchForm />

      <div className="flex min-h-0 flex-1 gap-4">
        <div className="glass-card flex w-[17.5rem] shrink-0 flex-col py-3.5">
          <CardLabel className="px-[1.125rem] pb-2">Holding bay</CardLabel>
          {waves.length === 0 ? (
            <p className="px-[1.125rem] text-item font-medium">No saved searches yet. Run one above.</p>
          ) : (
            <ul className="panel-scroll min-h-0 flex-1 overflow-y-auto px-2">
              {waves.map((w) => (
                <li key={w.id}>
                  <Link
                    href={`/explore?wave=${w.id}`}
                    className={`flex items-center gap-3 rounded-row px-2.5 py-2 ${
                      w.id === currentId ? "bg-row-selected" : "hover:bg-row-selected"
                    }`}
                  >
                    <span className="w-7 shrink-0 text-right font-mono text-score font-medium">
                      {searchingNow(w) || w.runStatus === "failed" ? "–" : w.jobCount}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-item leading-[1.35] font-medium">{w.query}</span>
                      <span className="block truncate text-meta leading-[1.35] font-medium">{w.when}</span>
                    </span>
                    {searchingNow(w) || w.runStatus === "failed" ? (
                      <span className="shrink-0 text-meta font-semibold">
                        {searchingNow(w) ? "searching" : "failed"}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {current ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
            <div className="shrink-0 px-1">
              <div className="truncate text-title leading-tight font-semibold">{current.query}</div>
              <div className="mt-1 text-meta font-medium">
                {[
                  current.when,
                  current.locations.join(", ") || null,
                  searchingNow(current)
                    ? "searching"
                    : `${current.jobCount} ${current.jobCount === 1 ? "job" : "jobs"}, unranked`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>

            <div className="shrink-0">
              {searchingNow(current) && current.runId ? (
                <WaveProgress runId={current.runId} />
              ) : current.runStatus === "failed" ? (
                <p className={`text-item ${errorMark}`}>Search failed: {current.runError}</p>
              ) : (
                <Promote wave={current} battlefields={battlefields} />
              )}
            </div>

            <ul className="panel-scroll min-h-0 flex-1 overflow-y-auto pb-4">
              {jobs.map((job, i) => (
                <li key={job.id}>
                  <div
                    className={`flex items-center gap-[0.8125rem] rounded-row px-3 py-[0.5625rem] ${
                      openId === job.id ? "bg-row-selected" : "hover:bg-row-selected"
                    }`}
                  >
                    <span className="w-7 shrink-0 text-right font-mono text-meta font-medium">{i + 1}</span>
                    <button
                      onClick={() => setOpenId(openId === job.id ? null : job.id)}
                      className="min-w-0 flex-1 text-left"
                      aria-expanded={openId === job.id}
                    >
                      <span className="block truncate text-item leading-[1.35] font-medium">{job.title}</span>
                      <span className="block truncate text-meta leading-[1.35] font-medium">
                        {[job.company, job.location].filter(Boolean).join(" - ")}
                      </span>
                    </button>
                    <a
                      href={job.url}
                      target="_blank"
                      className="shrink-0 text-meta font-semibold underline underline-offset-2"
                    >
                      Open posting
                    </a>
                  </div>
                  {openId === job.id ? (
                    <p className="px-3 pt-1 pb-4 pl-[3.5rem] text-item leading-[1.55] whitespace-pre-wrap">
                      {job.description ?? "No description."}
                    </p>
                  ) : null}
                </li>
              ))}
              {jobs.length === 0 && current.runStatus === "done" ? (
                <li className="px-3 py-4 text-item font-medium">This search found no jobs.</li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
