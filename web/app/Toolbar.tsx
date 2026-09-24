"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Preview = { unranked: number; alreadyRanked: number; rubricVersion: number };

async function call(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function Toolbar({
  battlefieldId,
  slug,
  hasRubric,
}: {
  battlefieldId: string;
  slug: string;
  hasRubric: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "search" | "rank" | "preview">(null);
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [rerank, setRerank] = useState(false);

  useEffect(() => {
    if (busy !== "search" && busy !== "rank") return;
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  function start(kind: "search" | "rank" | "preview") {
    setBusy(kind);
    setElapsed(0);
    setMessage(null);
  }

  async function search() {
    setPreview(null);
    start("search");
    try {
      const r = await call(`/api/battlefields/${battlefieldId}/search`, { method: "POST" });
      let text = `Found ${r.found}, ${r.new} new, ${r.alreadyApplied} you have already applied to.`;
      if (r.rank) {
        text += r.rank.error
          ? ` Auto-Rank failed: ${r.rank.error}`
          : ` Auto-ranked ${r.rank.ranked}.`;
      }
      setMessage({ text });
      router.refresh();
    } catch (e) {
      setMessage({ text: `Search failed: ${errorText(e)}`, error: true });
    } finally {
      setBusy(null);
    }
  }

  async function openRank() {
    start("preview");
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
    start("rank");
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

  const toRank = preview ? preview.unranked + (rerank ? preview.alreadyRanked : 0) : 0;
  const button =
    "rounded-md border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={search}
          disabled={busy !== null}
          className={`${button} border-gray-900 bg-gray-900 text-white`}
        >
          {busy === "search" ? "Searching..." : "Search New"}
        </button>
        <button
          onClick={openRank}
          disabled={busy !== null || !hasRubric}
          title={hasRubric ? undefined : "This Battlefield has no rubric yet"}
          className={`${button} border-gray-300 text-gray-700 hover:border-gray-500`}
        >
          {busy === "rank" ? "Ranking..." : "Rank"}
        </button>
        {!hasRubric ? (
          <Link
            href={`/battlefields/${slug}/settings`}
            className="text-xs text-gray-500 underline"
          >
            Add a rubric to rank
          </Link>
        ) : null}
        {busy === "search" || busy === "rank" ? (
          <span className="text-xs tabular-nums text-gray-500">
            {clock(elapsed)}
            {busy === "search" ? " - a sweep takes a few minutes" : ""}
          </span>
        ) : null}
        {message ? (
          <span className={`text-sm ${message.error ? "text-red-700" : "text-gray-700"}`}>
            {message.text}
          </span>
        ) : null}
      </div>

      {preview ? (
        <div className="mt-3 rounded-lg border border-gray-200 p-4 text-sm">
          <p>
            {preview.unranked} {preview.unranked === 1 ? "job is" : "jobs are"} unranked.{" "}
            {preview.alreadyRanked} already {preview.alreadyRanked === 1 ? "has a grade" : "have grades"}.
          </p>
          {preview.alreadyRanked > 0 ? (
            <label className="mt-2 flex items-center gap-2 text-gray-600">
              <input
                type="checkbox"
                checked={rerank}
                onChange={(e) => setRerank(e.target.checked)}
              />
              Also re-rank the {preview.alreadyRanked} using the current rubric (v
              {preview.rubricVersion})
            </label>
          ) : null}
          <div className="mt-3 flex gap-2">
            <button
              onClick={rank}
              disabled={toRank === 0}
              className={`${button} border-gray-900 bg-gray-900 text-white`}
            >
              {toRank === 0 ? "Nothing to rank" : `Rank ${toRank}`}
            </button>
            <button
              onClick={() => setPreview(null)}
              className={`${button} border-gray-300 text-gray-700`}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
