"use client";

// Tracking: the jobs you have set a status on, grouped by stage. Same shell and
// patterns as Discovery: the selected job's card with Score and Grade, then the
// grouped list in the job-list row pattern.

import { useState } from "react";
import Link from "next/link";
import { setStatus, saveNote } from "../actions";
import { CardLabel, GradeDot, StatCard, btnPrimary, field } from "../shell/ui";

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
  battlefield,
}: {
  jobs: Job[];
  battlefield: { slug: string; name: string } | null;
}) {
  const [selectedId, setSelectedId] = useState(jobs[0]?.id ?? null);
  const selected = jobs.find((j) => j.id === selectedId) ?? null;
  const notedStages = selected ? STAGES.filter((s) => selected.notes[s]) : [];

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 px-6 pt-6">
      <div className="shrink-0">
        <h1 className="font-display text-heading font-bold tracking-[-0.015em]">Tracking</h1>
        <p className="mt-1 text-item font-medium">
          {battlefield ? `${battlefield.name}, ${jobs.length} tracked` : "No Battlefields yet"}
        </p>
      </div>

      {jobs.length === 0 ? (
        <p className="text-item font-medium">
          Nothing tracked{battlefield ? ` in ${battlefield.name}` : ""} yet. Set a status on a job in{" "}
          {battlefield ? (
            <Link href={`/battlefields/${battlefield.slug}`} className="underline underline-offset-2">
              Discovery
            </Link>
          ) : (
            "Discovery"
          )}
          .
        </p>
      ) : null}

      {selected ? (
        <>
          <div className="flex shrink-0 gap-3.5">
            <div className="glass-card min-w-0 flex-1 px-5 py-[1.125rem]">
              <CardLabel>Selected</CardLabel>
              <h2 className="mt-2 text-title leading-tight font-semibold">{selected.title}</h2>
              <p className="mt-1.5 text-item font-medium">
                {[selected.company, selected.location].filter(Boolean).join(" · ")}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                <a href={selected.url} target="_blank" className={`${btnPrimary} mr-1.5`}>
                  Open posting
                </a>
                {STAGES.map((stage) => (
                  <button
                    key={stage}
                    onClick={() => setStatus(selected.id, stage)}
                    aria-pressed={selected.status === stage}
                    className={`rounded-btn border px-3 py-1.5 text-button font-semibold ${
                      selected.status === stage
                        ? "border-autumn-deep bg-autumn-deep"
                        : "border-secondary-edge bg-secondary hover:bg-hover"
                    }`}
                  >
                    {stage}
                  </button>
                ))}
              </div>
              <textarea
                key={selected.id + selected.status}
                defaultValue={selected.notes[selected.status] ?? ""}
                onBlur={(e) => saveNote(selected.id, selected.status, e.target.value)}
                placeholder={`Note for ${selected.status}, saves when you click away`}
                aria-label={`Note for ${selected.status}`}
                className={`${field} mt-3 w-full resize-none placeholder:text-white placeholder:opacity-80`}
                rows={2}
              />
            </div>
            <StatCard
              label="Score"
              colour="bg-autumn"
              mono
              value={selected.score ?? "–"}
              sub={selected.score != null ? "Under the current rubric" : "Not ranked yet"}
            />
            <StatCard
              label="Stage"
              colour="bg-slate"
              size="text-grade"
              value={selected.status}
              sub={selected.grade ? `Graded ${selected.grade}` : "Unranked"}
            />
          </div>

          {notedStages.length || selected.reason ? (
            <div className="glass-card panel-scroll max-h-[28vh] shrink-0 overflow-y-auto px-[1.125rem] py-3.5">
              {notedStages.length ? (
                <>
                  <CardLabel>All notes</CardLabel>
                  <ul className="mt-2 space-y-2">
                    {notedStages.map((s) => (
                      <li key={s} className="text-item leading-[1.55]">
                        <span className="font-semibold">{s}:</span>{" "}
                        <span className="whitespace-pre-wrap">{selected.notes[s]}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {selected.reason ? (
                <>
                  <CardLabel className={notedStages.length ? "mt-3" : ""}>Why this grade</CardLabel>
                  <p className="mt-2 text-item leading-[1.55]">{selected.reason}</p>
                </>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {jobs.length ? (
        <div className="panel-scroll min-h-0 flex-1 overflow-y-auto pb-4">
          {STAGES.map((stage) => {
            const inStage = jobs.filter((j) => j.status === stage);
            if (inStage.length === 0) return null;
            return (
              <section key={stage} className="mb-3">
                <CardLabel className="px-1 pb-1.5">
                  {stage} ({inStage.length})
                </CardLabel>
                <ul>
                  {inStage.map((job) => (
                    <li key={job.id}>
                      <button
                        onClick={() => setSelectedId(job.id)}
                        className={`flex w-full items-center gap-[0.8125rem] rounded-row px-3 py-[0.5625rem] text-left ${
                          job.id === selectedId ? "bg-row-selected" : "hover:bg-row-selected"
                        } ${job.grade === "Unfit" ? "opacity-[0.72]" : ""}`}
                      >
                        <span className="w-7 shrink-0 text-right font-mono text-score font-medium">
                          {job.score ?? "–"}
                        </span>
                        <GradeDot grade={job.grade} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-item leading-[1.35] font-medium">
                            {job.title}
                          </span>
                          <span className="block truncate text-meta leading-[1.35] font-medium">
                            {[job.company, job.location].filter(Boolean).join(" - ")}
                          </span>
                        </span>
                        <span className="shrink-0 text-meta font-semibold">{job.grade ?? "unranked"}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
