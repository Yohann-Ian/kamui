"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setStatus, saveNote, dismissJob } from "./actions";
import BattlefieldSwitch, { type BattlefieldLink } from "./BattlefieldSwitch";
import Toolbar from "./Toolbar";

const STAGES = ["Aim", "Applied", "Screening", "Interview", "Offer", "Rejected", "Dropped"];

type Job = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  url: string;
  description: string | null;
  grade: string | null;
  score: number | null;
  reason: string | null;
  staleRubricVersion: number | null;
  status: string | null;
  notes: Record<string, string>;
  closed: boolean;
  lastSeenDays: number;
};

type Battlefield = {
  id: string;
  slug: string;
  name: string;
  titleIncludes: string[];
  locations: string[];
  archived: boolean;
  rubricVersion: number | null;
};

const gradeStyles: Record<string, string> = {
  Fit: "bg-green-100 text-green-800",
  Possible: "bg-blue-100 text-blue-800",
  Improbable: "bg-gray-100 text-gray-600",
  Unfit: "bg-red-100 text-red-800",
};

function seenText(days: number) {
  if (days <= 0) return "seen today";
  return days === 1 ? "seen yesterday" : `seen ${days} days ago`;
}

export default function JobBoard({
  jobs,
  hiddenCount,
  activeSearchRunId,
  battlefields,
  battlefield,
}: {
  jobs: Job[];
  hiddenCount: number;
  activeSearchRunId: string | null;
  battlefields: BattlefieldLink[];
  battlefield: Battlefield;
}) {
  const router = useRouter();
  const [sort, setSort] = useState<"score" | "lastSeen">("score");
  const [seenWithin, setSeenWithin] = useState(0); // days, 0 = any time

  const shown = jobs
    .filter((j) => seenWithin === 0 || j.lastSeenDays <= seenWithin)
    .sort((a, b) =>
      sort === "lastSeen"
        ? a.lastSeenDays - b.lastSeenDays
        : Number(a.closed) - Number(b.closed) || (b.score ?? -1) - (a.score ?? -1)
    );
  const [selectedId, setSelectedId] = useState(shown[0]?.id ?? null);
  const selected = jobs.find((j) => j.id === selectedId) ?? null;

  // Check whether a posting has closed when its detail panel is opened, once
  // per job per visit. Never in bulk.
  const checked = useRef(new Set<string>());
  const selectedClosed = selected?.closed ?? true;
  useEffect(() => {
    if (!selectedId || selectedClosed || checked.current.has(selectedId)) return;
    checked.current.add(selectedId);
    fetch(`/api/jobs/${selectedId}/check-closed`)
      .then((res) => res.json())
      .then((result) => {
        if (result.closed) router.refresh();
      })
      .catch(() => {});
  }, [selectedId, selectedClosed, router]);

  const noJobsYet = jobs.length === 0 && hiddenCount === 0;

  return (
    <main className="mx-auto flex max-w-6xl gap-6 px-6 py-10">
      <section className="min-w-0 flex-1">
        <div className="mb-4 flex items-center justify-between gap-4 border-b border-gray-200 pb-3">
          <BattlefieldSwitch battlefields={battlefields} current={battlefield.slug} basePath="/" />
          <div className="flex shrink-0 items-baseline gap-4">
            <span className="text-sm text-gray-500">
              {jobs.length} open
              {hiddenCount > 0 ? `, ${hiddenCount} already applied` : ""}
            </span>
            <Link
              href={`/battlefields/${battlefield.slug}/settings`}
              className="text-sm text-gray-500 hover:text-gray-900"
            >
              Settings
            </Link>
            <Link
              href={`/tracking?battlefield=${battlefield.slug}`}
              className="text-sm text-gray-500 hover:text-gray-900"
            >
              Tracking
            </Link>
            <Link href="/explore" className="text-sm text-gray-500 hover:text-gray-900">
              Explore
            </Link>
          </div>
        </div>

        {battlefield.archived ? (
          <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {battlefield.name} is archived. Restore it from its Settings page.
          </p>
        ) : null}

        <Toolbar
          battlefieldId={battlefield.id}
          slug={battlefield.slug}
          hasRubric={battlefield.rubricVersion !== null}
          activeSearchRunId={activeSearchRunId}
        />

        {noJobsYet ? (
          <div className="rounded-lg border border-dashed border-gray-300 px-6 py-10 text-center">
            <p className="font-medium">No jobs in {battlefield.name} yet.</p>
            <p className="mt-1 text-sm text-gray-500">
              Click Search New to run its first search for{" "}
              {battlefield.titleIncludes.map((t) => `"${t}"`).join(", ")}
              {battlefield.locations.length ? ` in ${battlefield.locations.join(", ")}` : ""}.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-2 flex items-center gap-3 text-xs text-gray-500">
              <label className="flex items-center gap-1">
                Sort
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as "score" | "lastSeen")}
                  className="rounded border border-gray-200 px-1 py-0.5"
                >
                  <option value="score">Score</option>
                  <option value="lastSeen">Last seen</option>
                </select>
              </label>
              <label className="flex items-center gap-1">
                Seen
                <select
                  value={seenWithin}
                  onChange={(e) => setSeenWithin(Number(e.target.value))}
                  className="rounded border border-gray-200 px-1 py-0.5"
                >
                  <option value={0}>any time</option>
                  <option value={7}>in the last 7 days</option>
                  <option value={30}>in the last 30 days</option>
                </select>
              </label>
            </div>

            <ul>
              {shown.map((job) => (
                <li
                  key={job.id}
                  className={`group flex items-center border-b border-gray-100 ${
                    job.id === selectedId ? "bg-gray-50" : "hover:bg-gray-50"
                  }`}
                >
                  <button
                    onClick={() => setSelectedId(job.id)}
                    className={`flex min-w-0 flex-1 items-center gap-4 px-2 py-2.5 text-left ${
                      job.closed ? "opacity-40" : job.grade === "Unfit" ? "opacity-60" : ""
                    }`}
                  >
                    <span className="w-8 shrink-0 text-right text-xl font-medium tabular-nums text-gray-800">
                      {job.score ?? "-"}
                    </span>
                    <span
                      className={`w-20 shrink-0 rounded-full py-0.5 text-center text-xs ${
                        job.grade
                          ? gradeStyles[job.grade] ?? "bg-gray-100 text-gray-600"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {job.grade ?? "unranked"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div
                        className={`truncate text-[15px] font-medium leading-tight ${
                          job.closed ? "line-through" : ""
                        }`}
                      >
                        {job.closed ? (
                          <span className="mr-2 rounded bg-gray-200 px-1.5 py-0.5 text-[11px] font-normal no-underline">
                            Closed
                          </span>
                        ) : null}
                        {job.title}
                      </div>
                      <div className="truncate text-[13px] leading-tight text-gray-500">
                        {job.company} - {job.location}
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] text-gray-400">
                      {seenText(job.lastSeenDays)}
                    </span>
                  </button>
                  <button
                    onClick={() => dismissJob(job.id)}
                    title="Dismiss from this Battlefield"
                    className="px-3 py-2 text-gray-300 opacity-0 hover:text-gray-900 group-hover:opacity-100"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>

            {shown.length === 0 ? (
              <p className="py-6 text-sm text-gray-400">No jobs match this filter.</p>
            ) : null}
          </>
        )}
      </section>

      <aside className="sticky top-10 h-fit w-96 shrink-0 rounded-lg border border-gray-200 p-5">
        {selected ? (
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {selected.score !== null ? `${selected.score} - ${selected.grade}` : "unranked"}
              {selected.staleRubricVersion !== null
                ? ` (rubric v${selected.staleRubricVersion})`
                : ""}
            </div>
            <h2 className="text-lg font-medium leading-tight">
              {selected.closed ? (
                <span className="mr-2 rounded bg-gray-200 px-1.5 py-0.5 align-middle text-xs font-normal">
                  Closed
                </span>
              ) : null}
              {selected.title}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {selected.company} - {selected.location}
            </p>
            <p className="mt-1 text-xs text-gray-400">{seenText(selected.lastSeenDays)}</p>

            <div className="mt-4 flex items-center gap-3">
              <a
                href={selected.url}
                target="_blank"
                className="inline-block rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white"
              >
                Open posting
              </a>
              <button
                onClick={() => dismissJob(selected.id)}
                className="text-sm text-gray-400 hover:text-gray-900"
              >
                Dismiss
              </button>
            </div>

            <div className="mt-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Status
              </div>
              <div className="flex flex-wrap gap-1.5">
                {STAGES.map((stage) => (
                  <button
                    key={stage}
                    onClick={() => setStatus(selected.id, stage)}
                    className={`rounded-md border px-2.5 py-1 text-xs ${
                      selected.status === stage
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 text-gray-600 hover:border-gray-400"
                    }`}
                  >
                    {stage}
                  </button>
                ))}
              </div>

              {selected.status ? (
                <div className="mt-3">
                  <div className="mb-1 text-xs text-gray-400">Note for {selected.status}</div>
                  <textarea
                    key={selected.id + selected.status}
                    defaultValue={selected.notes[selected.status] ?? ""}
                    onBlur={(e) => saveNote(selected.id, selected.status!, e.target.value)}
                    placeholder="Write a note, it saves when you click away"
                    className="w-full rounded-md border border-gray-200 p-2 text-[13px]"
                    rows={3}
                  />
                </div>
              ) : null}
            </div>

            {selected.reason ? (
              <div className="mt-5">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Why this grade
                </div>
                <p className="text-sm text-gray-700">{selected.reason}</p>
              </div>
            ) : null}

            <div className="mt-5">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Description
              </div>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-gray-600">
                {selected.description ?? "No description."}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Select a job.</p>
        )}
      </aside>
    </main>
  );
}
