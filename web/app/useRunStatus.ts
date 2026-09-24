"use client";

import { useEffect, useState } from "react";

export type RunStatus = {
  runId: string;
  status: "running" | "ingesting" | "done" | "failed";
  startedAt: string;
  progress: string[];
  found: number;
  new: number;
  alreadyApplied: number;
  error: string | null;
  autoRank: "started" | null;
};

export const isActive = (s: RunStatus | null) => s?.status === "running" || s?.status === "ingesting";

// Polls GET /api/runs/<runId> until the Run is done or failed. Each poll is
// also what makes the server ingest the results once Apify has finished.
export function useRunStatus(runId: string | null, intervalMs = 5000) {
  const [status, setStatus] = useState<RunStatus | null>(null);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch(`/api/runs/${runId}`);
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setStatus({ runId, status: "failed", error: body.error } as RunStatus);
          return;
        }
        setStatus(body);
        if (isActive(body)) timer = setTimeout(poll, intervalMs);
      } catch {
        // a network blip: keep trying, a little slower
        if (!cancelled) timer = setTimeout(poll, intervalMs * 2);
      }
    }
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [runId, intervalMs]);

  // ignore a status left over from a previous run id
  return status?.runId === runId ? status : null;
}

export function elapsedSince(startedAt: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

// A clock that ticks once a second while `on` is true (0 until the first tick).
export function useNow(on: boolean) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!on) return;
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 1000);
    const first = setTimeout(tick, 0);
    return () => {
      clearInterval(timer);
      clearTimeout(first);
    };
  }, [on]);
  return now;
}
