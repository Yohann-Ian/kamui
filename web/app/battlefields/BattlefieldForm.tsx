"use client";

import { useActionState } from "react";
import type { FormState } from "./actions";

export type SearchFields = {
  name: string;
  titleIncludes: string[];
  titleExcludes: string[];
  locations: string[];
  maxBoards: number;
  maxJobs: number;
  maxJobsPerBoard: number;
};

const input = "w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm";
const label = "mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400";
const hint = "mt-1 text-xs text-gray-400";

export default function BattlefieldForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaults: SearchFields;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label className={label} htmlFor="name">
          Name
        </label>
        <input id="name" name="name" defaultValue={defaults.name} className={input} />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div>
          <label className={label} htmlFor="titleIncludes">
            Title keywords
          </label>
          <textarea
            id="titleIncludes"
            name="titleIncludes"
            rows={5}
            defaultValue={defaults.titleIncludes.join("\n")}
            className={input}
          />
          <p className={hint}>One per line. A job title must contain at least one.</p>
        </div>
        <div>
          <label className={label} htmlFor="titleExcludes">
            Title excludes
          </label>
          <textarea
            id="titleExcludes"
            name="titleExcludes"
            rows={5}
            defaultValue={defaults.titleExcludes.join("\n")}
            className={input}
          />
          <p className={hint}>One per line. A title containing any of these is dropped.</p>
        </div>
        <div>
          <label className={label} htmlFor="locations">
            Locations
          </label>
          <textarea
            id="locations"
            name="locations"
            rows={5}
            defaultValue={defaults.locations.join("\n")}
            className={input}
          />
          <p className={hint}>One per line, e.g. United States. Each is a separate search.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div>
          <label className={label} htmlFor="maxBoards">
            Max boards
          </label>
          <input
            id="maxBoards"
            name="maxBoards"
            type="number"
            min={1}
            defaultValue={defaults.maxBoards}
            className={input}
          />
          <p className={hint}>Career sites scanned per search.</p>
        </div>
        <div>
          <label className={label} htmlFor="maxJobs">
            Max jobs
          </label>
          <input
            id="maxJobs"
            name="maxJobs"
            type="number"
            min={1}
            defaultValue={defaults.maxJobs}
            className={input}
          />
          <p className={hint}>Apify bills per job, so this caps each location&apos;s cost.</p>
        </div>
        <div>
          <label className={label} htmlFor="maxJobsPerBoard">
            Max jobs per board
          </label>
          <input
            id="maxJobsPerBoard"
            name="maxJobsPerBoard"
            type="number"
            min={1}
            defaultValue={defaults.maxJobsPerBoard}
            className={input}
          />
          <p className={hint}>Stops one huge company filling the results.</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Saving..." : submitLabel}
        </button>
        {state.error ? <span className="text-sm text-red-700">{state.error}</span> : null}
        {state.saved ? <span className="text-sm text-gray-600">{state.saved}</span> : null}
      </div>
    </form>
  );
}
