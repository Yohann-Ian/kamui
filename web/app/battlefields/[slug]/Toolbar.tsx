"use client";

// Search New (primary) and Rank (secondary), under the All jobs label, with
// the search progress line and the rank confirmation beneath them. Search New
// starts the search and polls its Run; Rank shows rank-preview and asks before
// spending anything.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { elapsedSince, isActive, useNow, useRunStatus, type RunStatus } from "../../useRunStatus";
import { btnPrimary, btnSecondary } from "../../shell/ui";

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
}: {
  battlefieldId: string;
  slug: string;
  hasRubric: boolean;
  unranked: number;
  activeSearchRunId: string | null; // a search still running when the page loaded
}) {
  const router = useRouter();
  const [searchRunId, setSearchRunId] = useState(activeSearchRunId);
  const [starting, setStarting] = useState(false);
  const [busy, setBusy] = useState<null | "rank" | "preview">(null);
  const [rankStartedAt, setRankStartedAt] = useState("");
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [rerank, setRerank] = useState(false);

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
      const r = await call(`/api/battlefields/${battlefieldId}/search`, { method: "POST" });
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
      <div className="flex flex-wrap gap-2.5">
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
