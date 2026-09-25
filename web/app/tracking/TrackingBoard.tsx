"use client";

import { useState } from "react";
import Link from "next/link";
import { setStatus, saveNote } from "../actions";
type BattlefieldLink = { slug: string; name: string };

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
  status: string;
  notes: Record<string, string>;
};

export default function TrackingBoard({
  jobs,
  battlefields,
  current,
}: {
  jobs: Job[];
  battlefields: BattlefieldLink[];
  current: string;
}) {
  const [selectedId, setSelectedId] = useState(jobs[0]?.id ?? null);
  const selected = jobs.find((j) => j.id === selectedId) ?? null;

  return (
    <main className="mx-auto flex max-w-6xl gap-6 px-6 py-10">
      <section className="min-w-0 flex-1">
        <div className="mb-4 flex items-center justify-between border-b border-gray-200 pb-3">
          <span>{battlefields.find((b) => b.slug === current)?.name}</span>
          <div className="flex items-baseline gap-4">
            <span className="text-sm text-gray-500">{jobs.length} tracked</span>
            <Link
              href={`/battlefields/${current}`}
              className="text-sm text-gray-500 hover:text-gray-900"
            >
              Discovery
            </Link>
          </div>
        </div>

        {STAGES.map((stage) => {
          const inStage = jobs.filter((j) => j.status === stage);
          if (inStage.length === 0) return null;
          return (
            <section key={stage} className="mb-6">
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {stage} ({inStage.length})
              </h2>
              <ul className="border-t border-gray-100">
                {inStage.map((job) => (
                  <li key={job.id}>
                    <button
                      onClick={() => setSelectedId(job.id)}
                      className={`flex w-full items-center gap-4 border-b border-gray-100 px-2 py-2.5 text-left ${
                        job.id === selectedId ? "bg-gray-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <span className="w-8 shrink-0 text-right text-sm tabular-nums text-gray-400">
                        {job.score ?? "-"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[15px] font-medium leading-tight">
                          {job.title}
                        </div>
                        <div className="truncate text-[13px] leading-tight text-gray-500">
                          {job.company} - {job.location}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {jobs.length === 0 ? (
          <p className="text-sm text-gray-400">
            Nothing tracked yet. Set a status on a job in Discovery.
          </p>
        ) : null}
      </section>

      <aside className="sticky top-10 h-fit w-96 shrink-0 rounded-lg border border-gray-200 p-5">
        {selected ? (
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {selected.score !== null ? `${selected.score} - ${selected.grade}` : "unranked"}
            </div>
            <h2 className="text-lg font-medium leading-tight">{selected.title}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {selected.company} - {selected.location}
            </p>

            <a
              href={selected.url}
              target="_blank"
              className="mt-4 inline-block rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white"
            >
              Open posting
            </a>

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

              <div className="mt-3">
                <div className="mb-1 text-xs text-gray-400">Note for {selected.status}</div>
                <textarea
                  key={selected.id + selected.status}
                  defaultValue={selected.notes[selected.status] ?? ""}
                  onBlur={(e) => saveNote(selected.id, selected.status, e.target.value)}
                  placeholder="Write a note, it saves when you click away"
                  className="w-full rounded-md border border-gray-200 p-2 text-[13px]"
                  rows={3}
                />
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                All notes
              </div>
              {Object.keys(selected.notes).length === 0 ? (
                <p className="text-[13px] text-gray-400">No notes yet.</p>
              ) : (
                <ul className="space-y-2">
                  {STAGES.filter((s) => selected.notes[s]).map((s) => (
                    <li key={s}>
                      <div className="text-[11px] uppercase tracking-wide text-gray-400">{s}</div>
                      <p className="whitespace-pre-wrap text-[13px] text-gray-600">
                        {selected.notes[s]}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
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
