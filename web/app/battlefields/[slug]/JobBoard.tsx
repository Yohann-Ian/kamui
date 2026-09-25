"use client";

// Discovery: the header, then two sides. On the left, All jobs: Search New and
// Rank, then the list at full height. On the right, the selected job: its card
// (with small Score, Grade and Pay tiles, actions, status and note) beside a
// tall card holding "Why this grade" and the full description.

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

// A small stat tile inside the selected card: describes the one selected job
function Tile({
  label,
  value,
  sub,
  colour,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  sub: string;
  colour: string;
  mono?: boolean;
}) {
  return (
    <div className={`min-w-0 flex-1 rounded-row px-3 py-2.5 ${colour}`}>
      <CardLabel>{label}</CardLabel>
      <div className={`mt-0.5 truncate text-title leading-tight font-semibold ${mono ? "font-mono" : ""}`}>
        {value}
      </div>
      <div className="mt-0.5 text-label leading-snug font-medium opacity-85">{sub}</div>
    </div>
  );
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
    <section className="flex h-full min-h-0 flex-col gap-5 px-6 pt-6">
      <div className="shrink-0">
        <h1 className="truncate font-display text-heading font-bold tracking-[-0.015em]">{battlefield.name}</h1>
        <p className="mt-1 text-item font-medium">
          {stats}
          {battlefield.archived ? ". Archived: restore it from its settings." : ""}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        {/* All jobs: controls, then the list at full height */}
        <div className="flex w-[25rem] shrink-0 flex-col">
          <CardLabel className="px-1">All jobs</CardLabel>
          <div className="mt-3.5 px-1">
            <Toolbar
              battlefieldId={battlefield.id}
              slug={battlefield.slug}
              hasRubric={battlefield.rubricVersion !== null}
              unranked={unranked}
              activeSearchRunId={activeSearchRunId}
            />
          </div>

          {noJobsYet ? (
            <p className="mt-5 px-1 text-item leading-[1.55] font-medium">
              No jobs in {battlefield.name} yet. Click Search New to run its first search for{" "}
              {battlefield.titleIncludes.map((t) => `"${t}"`).join(", ")}
              {battlefield.locations.length ? ` in ${battlefield.locations.join(", ")}` : ""}.
            </p>
          ) : (
            <>
              <div className="mt-5 flex shrink-0 items-center gap-3 px-1 pb-2 text-meta font-medium">
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
                    <option value={7}>last 7 days</option>
                    <option value={30}>last 30 days</option>
                  </select>
                </label>
              </div>

              <ul className="panel-scroll min-h-0 flex-1 overflow-y-auto pb-4">
                {shown.map((job) => (
                  <li key={job.id} className="group relative">
                    <button
                      onClick={() => setSelectedId(job.id)}
                      className={`flex w-full items-center gap-[0.8125rem] rounded-row px-3 py-[0.5625rem] pr-8 text-left ${
                        job.id === selectedId ? "bg-row-selected" : "hover:bg-row-selected"
                      } ${job.grade === "Unfit" || job.closed ? "opacity-[0.72]" : ""}`}
                    >
                      <span className="w-7 shrink-0 text-right font-mono text-score font-medium">
                        {job.score ?? "–"}
                      </span>
                      <GradeDot grade={job.grade} />
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate text-item leading-[1.35] font-medium ${job.closed ? "line-through" : ""}`}
                        >
                          {job.title}
                        </span>
                        <span className="block truncate text-meta leading-[1.35] font-medium">
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
                      className="absolute top-1/2 right-1 -translate-y-1/2 rounded-btn px-1.5 py-0.5 text-item opacity-0 group-hover:opacity-100 hover:bg-hover focus:opacity-100"
                    >
                      ×
                    </button>
                  </li>
                ))}
                {shown.length === 0 ? (
                  <li className="px-3 py-4 text-item font-medium">No jobs match this filter.</li>
                ) : null}
              </ul>
            </>
          )}
        </div>

        {/* The selected job: its card, and a tall card to read it in */}
        {selected ? (
          <div className="flex min-h-0 min-w-0 flex-1 gap-4 pb-4">
            <div className="glass-card panel-scroll flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-5 py-[1.125rem]">
              <CardLabel>Selected</CardLabel>
              <h2 className="mt-2 text-title leading-tight font-semibold">
                <span className={selected.closed ? "mr-2 line-through" : ""}>{selected.title}</span>
                {selected.closed ? <span className="text-meta font-semibold">Closed</span> : null}
              </h2>
              <p className="mt-1.5 text-item leading-[1.45] font-medium">
                {[
                  selected.company,
                  selected.location,
                  selected.postedDays != null ? `posted ${daysAgo(selected.postedDays)}` : null,
                  `seen ${daysAgo(selected.lastSeenDays)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>

              <div className="mt-4 flex gap-2">
                <Tile
                  label="Score"
                  colour="bg-autumn"
                  mono
                  value={selected.score ?? "–"}
                  sub={scoreRank ? `${ordinal(scoreRank)} highest here` : "Not ranked yet"}
                />
                <Tile
                  label="Grade"
                  colour="bg-slate"
                  value={selected.grade ?? "Unranked"}
                  sub={
                    selected.staleRubricVersion !== null
                      ? `Under rubric v${selected.staleRubricVersion}`
                      : selected.grade
                        ? GRADE_NOTE[selected.grade] ?? ""
                        : "Rank to grade it"
                  }
                />
                {selected.pay ? (
                  <Tile
                    label="Pay"
                    colour="bg-lavender"
                    mono
                    value={payValue(selected.pay)}
                    sub={payNote(selected.pay)}
                  />
                ) : null}
              </div>

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
                        : "border-secondary-edge bg-secondary hover:bg-hover"
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
                  className={`${field} mt-3 w-full shrink-0 resize-none placeholder:text-white placeholder:opacity-80`}
                  rows={3}
                />
              ) : null}
            </div>

            <div className="glass-card flex min-h-0 min-w-0 flex-1 flex-col px-5 py-[1.125rem]">
              <CardLabel>Why this grade</CardLabel>
              <p className="mt-2 text-item leading-[1.55]">
                {selected.reason ?? "Not ranked yet. Rank this Battlefield to grade it."}
              </p>
              {selected.keyGap ? (
                <p className="mt-2 text-item leading-[1.55]">
                  <span className="font-semibold">Biggest gap:</span> {selected.keyGap}
                </p>
              ) : null}
              <div className="mt-4 border-t border-divider pt-4">
                <CardLabel>Description</CardLabel>
              </div>
              <p className="panel-scroll mt-2 min-h-0 flex-1 overflow-y-auto pr-1 text-item leading-[1.55] whitespace-pre-wrap">
                {selected.description ?? "No description."}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
