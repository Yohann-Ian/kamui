"use client";

// The search bar (terms to include and location chips), then Search New
// (primary) and Rank (secondary), with the search progress line and the rank
// confirmation beneath them. Search New starts a search for what the bar says
// and polls its Run; Rank shows rank-preview and asks before spending anything.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { elapsedSince, isActive, useNow, useRunStatus, type RunStatus } from "../../useRunStatus";
import { CardLabel, btnPrimary, btnSecondary } from "../../shell/ui";
import { PRESET_LOCATIONS } from "../../../lib/locations";
import { addCustomLocation, removeCustomLocation } from "../actions";

type Preview = { unranked: number; alreadyRanked: number; rubricVersion: number };

async function call(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

function searchLine(run: RunStatus, now: number) {
  if (run.status === "running") {
    const clock = now ? `${elapsedSince(run.startedAt, now)} - ` : "";
    return `Searching... ${clock}${run.progress.join(" / ") || "starting up"}`;
  }
  if (run.status === "ingesting") return "Saving the results...";
  if (run.status === "failed") return `Search failed: ${run.error ?? "unknown error"}`;
  let text = `Found ${run.found}, ${run.new} new, ${run.alreadyApplied} you have already applied to.`;
  if (run.autoRank === "started") text += " Auto-Rank is grading the new jobs in the background.";
  if (run.error) text += ` (${run.error})`;
  return text;
}

export default function Toolbar({
  battlefieldId,
  slug,
  hasRubric,
  unranked,
  activeSearchRunId,
  defaultTerms,
  customLocations,
}: {
  battlefieldId: string;
  slug: string;
  hasRubric: boolean;
  unranked: number;
  activeSearchRunId: string | null; // a search still running when the page loaded
  defaultTerms: string[]; // the Battlefield's default settings
  customLocations: string[]; // chips added with "+ New Location"
}) {
  const router = useRouter();
  const [searchRunId, setSearchRunId] = useState(activeSearchRunId);
  const [starting, setStarting] = useState(false);
  const [busy, setBusy] = useState<null | "rank" | "preview">(null);
  const [rankStartedAt, setRankStartedAt] = useState("");
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [rerank, setRerank] = useState(false);
  const [terms, setTerms] = useState(defaultTerms.join(", "));
  const [picked, setPicked] = useState<string[]>(["all"]);

  const run = useRunStatus(searchRunId);
  const searching = starting || (!!searchRunId && (run === null || isActive(run)));
  const now = useNow(searching || busy === "rank");

  // Once a search finishes, reload the job list (once per run)
  const refreshed = useRef<string | null>(null);
  useEffect(() => {
    if (run && !isActive(run) && refreshed.current !== run.runId) {
      refreshed.current = run.runId;
      router.refresh();
    }
  }, [run, router]);

  async function search() {
    setPreview(null);
    setMessage(null);
    setStarting(true);
    try {
      const r = await call(`/api/battlefields/${battlefieldId}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          terms: terms.split(",").map((t) => t.trim()).filter(Boolean),
          locations: picked,
        }),
      });
      setSearchRunId(r.runId);
    } catch (e) {
      setMessage({ text: `Search failed to start: ${errorText(e)}`, error: true });
    } finally {
      setStarting(false);
    }
  }

  async function openRank() {
    setMessage(null);
    setBusy("preview");
    try {
      setPreview(await call(`/api/battlefields/${battlefieldId}/rank-preview`));
      setRerank(false);
    } catch (e) {
      setMessage({ text: errorText(e), error: true });
    } finally {
      setBusy(null);
    }
  }

  async function rank() {
    setPreview(null);
    setMessage(null);
    setRankStartedAt(new Date().toISOString());
    setBusy("rank");
    try {
      const r = await call(`/api/battlefields/${battlefieldId}/rank`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rerank }),
      });
      setMessage({
        text: `Ranked ${r.ranked}${r.failed ? `, ${r.failed} failed` : ""}.`,
        error: r.failed > 0,
      });
      router.refresh();
    } catch (e) {
      setMessage({ text: `Rank failed: ${errorText(e)}`, error: true });
    } finally {
      setBusy(null);
    }
  }

  const locked = searching || busy !== null;
  const toRank = preview ? preview.unranked + (rerank ? preview.alreadyRanked : 0) : 0;

  let status: { text: string; error?: boolean } | null = message;
  if (!status && busy === "rank") {
    status = { text: `Ranking... ${now ? elapsedSince(rankStartedAt, now) : ""}` };
  } else if (!status && starting) {
    status = { text: "Starting the search..." };
  } else if (!status && run) {
    status = { text: searchLine(run, now), error: run.status === "failed" };
  }

  return (
    <div className="shrink-0">
      <SearchBar
        battlefieldId={battlefieldId}
        terms={terms}
        onTerms={setTerms}
        defaultTerms={defaultTerms}
        picked={picked}
        onPicked={setPicked}
        customLocations={customLocations}
        disabled={locked}
      />

      <div className="mt-3.5 flex flex-wrap gap-2.5">
        <button onClick={search} disabled={locked} className={btnPrimary}>
          {searching ? "Searching..." : "Search New"}
        </button>
        <button
          onClick={openRank}
          disabled={locked || !hasRubric}
          title={hasRubric ? undefined : "This Battlefield has no rubric yet"}
          className={btnSecondary}
        >
          {busy === "rank" ? "Ranking..." : unranked > 0 ? `Rank ${unranked}` : "Rank"}
        </button>
      </div>

      {status || !hasRubric ? (
        <p className={`mt-2.5 text-meta leading-[1.45] font-medium ${searching ? "tabular-nums" : ""}`}>
          {status ? (
            <span className={status.error ? "font-semibold underline decoration-grade-unfit decoration-2 underline-offset-4" : ""}>
              {status.text}
            </span>
          ) : (
            <>
              No rubric yet, so nothing can be ranked.{" "}
              <Link href={`/battlefields/${slug}/settings`} className="underline underline-offset-2">
                Add one in settings
              </Link>
              .
            </>
          )}
          {searching ? " The search runs on Apify, so you can leave this page." : ""}
        </p>
      ) : null}

      {preview ? (
        <div className="glass-card mt-3 px-[1.125rem] py-3.5 text-item">
          <p>
            {preview.unranked} {preview.unranked === 1 ? "job is" : "jobs are"} unranked.{" "}
            {preview.alreadyRanked} already{" "}
            {preview.alreadyRanked === 1 ? "has a grade" : "have grades"}.
          </p>
          {preview.alreadyRanked > 0 ? (
            <label className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={rerank}
                onChange={(e) => setRerank(e.target.checked)}
                className="accent-autumn-deep"
              />
              Also re-rank the {preview.alreadyRanked} using the current rubric (v
              {preview.rubricVersion})
            </label>
          ) : null}
          <div className="mt-3 flex gap-2">
            <button onClick={rank} disabled={toRank === 0} className={btnPrimary}>
              {toRank === 0 ? "Nothing to rank" : `Rank ${toRank}`}
            </button>
            <button onClick={() => setPreview(null)} className={btnSecondary}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const chip = (on: boolean) =>
  `rounded-btn border px-2.5 py-1 text-meta font-semibold disabled:cursor-not-allowed ${
    on ? "border-autumn-deep bg-autumn-deep" : "border-secondary-edge bg-secondary hover:bg-hover"
  }`;

// Terms to include (comma-separated, starting from the default settings) and
// the locations to search. All Locations is exclusive: picking a place clears
// it, and clearing the last place brings it back.
function SearchBar({
  battlefieldId,
  terms,
  onTerms,
  defaultTerms,
  picked,
  onPicked,
  customLocations,
  disabled,
}: {
  battlefieldId: string;
  terms: string;
  onTerms: (terms: string) => void;
  defaultTerms: string[];
  picked: string[];
  onPicked: (picked: string[]) => void;
  customLocations: string[];
  disabled: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  function toggle(id: string) {
    if (id === "all") return onPicked(["all"]);
    const rest = picked.filter((p) => p !== "all");
    const next = rest.includes(id) ? rest.filter((p) => p !== id) : [...rest, id];
    onPicked(next.length ? next : ["all"]);
  }

  async function add() {
    const name = draft.trim();
    setAdding(false);
    setDraft("");
    if (!name) return;
    await addCustomLocation(battlefieldId, name);
    onPicked([...picked.filter((p) => p !== "all" && p !== name), name]);
  }

  async function remove(name: string) {
    const next = picked.filter((p) => p !== name);
    onPicked(next.length ? next : ["all"]);
    await removeCustomLocation(battlefieldId, name);
  }

  const isDefault = terms.split(",").map((t) => t.trim()).filter(Boolean).join(",") === defaultTerms.join(",");

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <CardLabel>Search</CardLabel>
        {!isDefault ? (
          <button
            onClick={() => onTerms(defaultTerms.join(", "))}
            className="text-meta font-medium underline underline-offset-2"
          >
            Reset to defaults
          </button>
        ) : null}
      </div>
      <input
        value={terms}
        onChange={(e) => onTerms(e.target.value)}
        disabled={disabled}
        placeholder="Terms to include, separated by commas"
        aria-label="Terms to include"
        title="A job title must contain one of these. Left empty, the default settings are used."
        className="glass-field mt-2 w-full px-2.5 py-1.5 text-item placeholder:text-white placeholder:opacity-80"
      />
      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Locations">
        {PRESET_LOCATIONS.map((l) => (
          <button
            key={l.id}
            onClick={() => toggle(l.id)}
            disabled={disabled}
            aria-pressed={picked.includes(l.id)}
            className={chip(picked.includes(l.id))}
          >
            {l.label}
          </button>
        ))}
        {customLocations.map((name) => (
          <span key={name} className="group relative inline-flex">
            <button
              onClick={() => toggle(name)}
              disabled={disabled}
              aria-pressed={picked.includes(name)}
              className={`${chip(picked.includes(name))} pr-6`}
            >
              {name}
            </button>
            <button
              onClick={() => remove(name)}
              disabled={disabled}
              title={`Remove ${name}`}
              aria-label={`Remove ${name}`}
              className="absolute top-1/2 right-1 -translate-y-1/2 rounded-btn px-1 text-meta leading-none font-semibold opacity-85 hover:opacity-100"
            >
              ×
            </button>
          </span>
        ))}
        {adding ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={add}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setDraft("");
                setAdding(false);
              }
            }}
            placeholder="City or country"
            aria-label="New location"
            className="glass-field w-[9rem] px-2 py-1 text-meta placeholder:text-white placeholder:opacity-80"
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            disabled={disabled}
            className="rounded-btn border border-dashed border-dash px-2.5 py-1 text-meta font-medium hover:bg-row-selected disabled:cursor-not-allowed"
          >
            + New Location
          </button>
        )}
      </div>
    </div>
  );
}
