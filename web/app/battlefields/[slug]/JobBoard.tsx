"use client";

// Discovery (DESIGN-SYSTEM.md section 4): header, the selected job's cards,
// "Why this grade", and the job list filling the remaining height.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setStatus, saveNote, dismissJob } from "../../actions";
import { markViewed } from "../actions";
import { CardLabel, GradeDot, btnPrimary, btnSecondary, daysAgo, field, ordinal } from "../../shell/ui";
import Toolbar from "./Toolbar";

const STAGES = ["Aim", "Applied", "Screening", "Interview", "Offer", "Rejected", "Dropped"];

const GRADE_NOTE: Record<string, string> = {
  Fit: "Strong match, worth applying",
  Possible: "Stretch, worth a tailored application",
  Improbable: "A real gap, long odds",
  Unfit: "Not this Battlefield's track",
};

type Pay = { min: number; max: number; currency: string | null; interval: string | null };

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
  keyGap: string | null;
  staleRubricVersion: number | null;
  status: string | null;
  notes: Record<string, string>;
  closed: boolean;
  lastSeenDays: number;
  postedDays: number | null;
  pay: Pay | null;
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

function payValue({ min, max, currency }: Pay) {
  const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
  const symbol = currency === "USD" ? "$" : "";
  return min === max ? `${symbol}${k(min)}` : `${symbol}${k(min)}–${k(max)}`;
}

function payNote({ currency, interval }: Pay) {
  const per = interval ? ` per ${interval}` : "";
  return `${currency ?? ""}${per}, stated in the posting`.trim();
}

export default function JobBoard({
  jobs,
  hiddenCount,
  unranked,
  activeSearchRunId,
  battlefield,
}: {
  jobs: Job[];
  hiddenCount: number;
  unranked: number;
  activeSearchRunId: string | null;
  battlefield: Battlefield;
}) {
  const router = useRouter();
  const [sort, setSort] = useState<"score" | "lastSeen">("score");
  const [seenWithin, setSeenWithin] = useState(0); // days, 0 = any time
  const [showDescription, setShowDescription] = useState(false);

  const shown = jobs
    .filter((j) => seenWithin === 0 || j.lastSeenDays <= seenWithin)
    .sort((a, b) =>
      sort === "lastSeen"
        ? a.lastSeenDays - b.lastSeenDays
        : Number(a.closed) - Number(b.closed) || (b.score ?? -1) - (a.score ?? -1)
    );
  const [selectedId, setSelectedId] = useState(shown[0]?.id ?? null);
  const selected = jobs.find((j) => j.id === selectedId) ?? null;

  // Opening Discovery marks this Battlefield's jobs as seen for the homepage
  useEffect(() => {
    markViewed(battlefield.id).catch(() => {});
  }, [battlefield.id]);

  // Check whether a posting has closed when it is selected, once per job per
  // visit. Never in bulk.
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

  // "2nd highest in this Battlefield"
  const scoreRank =
    selected?.score != null ? 1 + jobs.filter((j) => (j.score ?? -1) > selected.score!).length : null;

  const stats = `${jobs.length} open, ${unranked} unranked, ${hiddenCount} applied`;
  const noJobsYet = jobs.length === 0 && hiddenCount === 0;

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 px-6 pt-6">
      <Toolbar
        name={battlefield.name}
        stats={battlefield.archived ? `${stats}. Archived: restore it from its settings.` : stats}
        battlefieldId={battlefield.id}
        slug={battlefield.slug}
        hasRubric={battlefield.rubricVersion !== null}
        unranked={unranked}
        activeSearchRunId={activeSearchRunId}
      />

      {noJobsYet ? (
        <p className="text-item font-medium">
          No jobs in {battlefield.name} yet. Click Search New to run its first search for{" "}
          {battlefield.titleIncludes.map((t) => `"${t}"`).join(", ")}
          {battlefield.locations.length ? ` in ${battlefield.locations.join(", ")}` : ""}.
        </p>
      ) : null}

      {selected ? (
        <>
          <div className="flex shrink-0 gap-3.5">
            <div className="glass-card min-w-0 flex-1 px-5 py-[1.125rem]">
              <CardLabel>Selected</CardLabel>
              <h2 className="mt-2 text-title font-semibold leading-tight">
                {selected.closed ? <span className="mr-2 line-through">{selected.title}</span> : selected.title}
                {selected.closed ? <span className="text-meta font-semibold">Closed</span> : null}
              </h2>
              <p className="mt-1.5 text-item font-medium">
                {[
                  selected.company,
                  selected.location,
                  selected.postedDays != null ? `posted ${daysAgo(selected.postedDays)}` : null,
                  `seen ${daysAgo(selected.lastSeenDays)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={selected.url} target="_blank" className={btnPrimary}>
                  Open posting
                </a>
                <button onClick={() => dismissJob(selected.id)} className={btnSecondary}>
                  Dismiss
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Status">
                {STAGES.map((stage) => (
                  <button
                    key={stage}
                    onClick={() => setStatus(selected.id, stage)}
                    aria-pressed={selected.status === stage}
                    className={`rounded-btn border px-3 py-1.5 text-button font-semibold ${
                      selected.status === stage
                        ? "border-autumn-deep bg-autumn-deep"
                        : "border-secondary-edge bg-secondary hover:bg-white/20"
                    }`}
                  >
                    {stage}
                  </button>
                ))}
              </div>
              {selected.status ? (
                <textarea
                  key={selected.id + selected.status}
                  defaultValue={selected.notes[selected.status] ?? ""}
                  onBlur={(e) => saveNote(selected.id, selected.status!, e.target.value)}
                  placeholder={`Note for ${selected.status}, saves when you click away`}
                  aria-label={`Note for ${selected.status}`}
                  className={`${field} mt-3 w-full resize-none placeholder:text-white placeholder:opacity-80`}
                  rows={2}
                />
              ) : null}
            </div>

            <div className="flex w-stat shrink-0 flex-col rounded-card bg-autumn px-[1.0625rem] py-4">
              <CardLabel>Score</CardLabel>
              <div className="mt-1 font-mono text-big font-semibold leading-[1.1]">
                {selected.score ?? "–"}
              </div>
              <div className="mt-1 text-label font-medium leading-snug opacity-85">
                {scoreRank ? `${ordinal(scoreRank)} highest in this Battlefield` : "Not ranked yet"}
              </div>
            </div>

            <div className="flex w-stat shrink-0 flex-col rounded-card bg-slate px-[1.0625rem] py-4">
              <CardLabel>Grade</CardLabel>
              <div className="mt-1.5 text-grade font-semibold leading-tight">
                {selected.grade ?? "Unranked"}
              </div>
              <div className="mt-1 text-label font-medium leading-snug opacity-85">
                {selected.grade ? GRADE_NOTE[selected.grade] ?? "" : "Rank this Battlefield to grade it"}
                {selected.staleRubricVersion !== null ? ` (rubric v${selected.staleRubricVersion})` : ""}
              </div>
            </div>

            {selected.pay ? (
              <div className="flex w-stat shrink-0 flex-col rounded-card bg-lavender px-[1.0625rem] py-4">
                <CardLabel>Pay</CardLabel>
                <div className="mt-1.5 font-mono text-title font-semibold leading-tight">
                  {payValue(selected.pay)}
                </div>
                <div className="mt-1 text-label font-medium leading-snug opacity-85">
                  {payNote(selected.pay)}
                </div>
              </div>
            ) : null}
          </div>

          <div className="glass-card shrink-0 px-[1.125rem] py-3.5">
            <div className="flex items-baseline justify-between gap-4">
              <CardLabel>Why this grade</CardLabel>
              <button
                onClick={() => setShowDescription((v) => !v)}
                className="text-meta font-medium underline underline-offset-2"
              >
                {showDescription ? "Hide description" : "Show description"}
              </button>
            </div>
            <p className="mt-2 text-item leading-[1.55]">
              {selected.reason ?? "Not ranked yet. Rank this Battlefield to grade it."}
            </p>
            {selected.keyGap ? (
              <p className="mt-1 text-item leading-[1.55]">
                <span className="font-semibold">Biggest gap:</span> {selected.keyGap}
              </p>
            ) : null}
            {showDescription ? (
              <p className="panel-scroll mt-3 max-h-[30vh] overflow-y-auto border-t border-divider pt-3 text-item leading-[1.55] whitespace-pre-wrap">
                {selected.description ?? "No description."}
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      {!noJobsYet ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-4 px-1 pb-2">
            <CardLabel>All jobs</CardLabel>
            <div className="flex items-center gap-3 text-meta font-medium">
              <label className="flex items-center gap-1.5">
                sorted by
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as "score" | "lastSeen")}
                  className="glass-field px-1.5 py-0.5 text-meta"
                >
                  <option value="score">score</option>
                  <option value="lastSeen">last seen</option>
                </select>
              </label>
              <label className="flex items-center gap-1.5">
                seen
                <select
                  value={seenWithin}
                  onChange={(e) => setSeenWithin(Number(e.target.value))}
                  className="glass-field px-1.5 py-0.5 text-meta"
                >
                  <option value={0}>any time</option>
                  <option value={7}>in the last 7 days</option>
                  <option value={30}>in the last 30 days</option>
                </select>
              </label>
            </div>
          </div>

          <ul className="panel-scroll min-h-0 flex-1 overflow-y-auto pb-4">
            {shown.map((job) => (
              <li key={job.id} className="group relative">
                <button
                  onClick={() => setSelectedId(job.id)}
                  className={`flex w-full items-center gap-[0.8125rem] rounded-row px-3 py-[0.5625rem] pr-10 text-left ${
                    job.id === selectedId ? "bg-row-selected" : "hover:bg-row-selected"
                  } ${job.grade === "Unfit" || job.closed ? "opacity-[0.72]" : ""}`}
                >
                  <span className="w-7 shrink-0 text-right font-mono text-score font-medium">
                    {job.score ?? "–"}
                  </span>
                  <GradeDot grade={job.grade} />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-item font-medium leading-[1.35] ${job.closed ? "line-through" : ""}`}
                    >
                      {job.title}
                    </span>
                    <span className="block truncate text-meta font-medium leading-[1.35]">
                      {[job.company, job.location].filter(Boolean).join(" - ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-meta font-semibold">
                    {job.closed ? "Closed" : job.grade ?? "unranked"}
                  </span>
                </button>
                <button
                  onClick={() => dismissJob(job.id)}
                  title="Dismiss from this Battlefield"
                  aria-label={`Dismiss ${job.title}`}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-btn px-2 py-0.5 text-item opacity-0 group-hover:opacity-100 hover:bg-white/20 focus:opacity-100"
                >
                  ×
                </button>
              </li>
            ))}
            {shown.length === 0 ? (
              <li className="px-3 py-4 text-item font-medium">No jobs match this filter.</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
