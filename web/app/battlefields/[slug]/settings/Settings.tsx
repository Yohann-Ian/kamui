"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import BattlefieldForm, { type SearchFields } from "../../BattlefieldForm";
import { saveRubric, setArchived, setAutomation, updateBattlefield } from "../../actions";

type Battlefield = SearchFields & {
  id: string;
  slug: string;
  autoPopulate: boolean;
  autoRank: boolean;
  archived: boolean;
};

type RubricVersion = {
  id: string;
  version: number;
  active: boolean;
  body: string;
  createdOn: string;
  grades: number;
};

const heading = "mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400";

function Switch({
  battlefieldId,
  field,
  initial,
  title,
  children,
}: {
  battlefieldId: string;
  field: "autoPopulate" | "autoRank";
  initial: boolean;
  title: string;
  children: React.ReactNode;
}) {
  const [on, setOn] = useState(initial);
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex gap-3 rounded-lg border border-gray-200 p-4">
      <input
        type="checkbox"
        checked={on}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          setOn(next);
          startTransition(() => setAutomation(battlefieldId, field, next));
        }}
        className="mt-1"
      />
      <div>
        <div className="text-sm font-medium">
          {title}{" "}
          <span className={on ? "text-green-700" : "text-gray-400"}>{on ? "On" : "Off"}</span>
          <span className="ml-2 text-xs font-normal text-gray-400">off by default</span>
        </div>
        <p className="mt-1 text-sm text-gray-500">{children}</p>
      </div>
    </label>
  );
}

function RubricEditor({
  battlefieldId,
  rubrics,
}: {
  battlefieldId: string;
  rubrics: RubricVersion[];
}) {
  const active = rubrics.find((r) => r.active) ?? null;
  const [body, setBody] = useState(active?.body ?? "");
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function loadFile(file: File | undefined) {
    if (!file) return;
    setBody(await file.text());
    setMessage({ text: `Loaded ${file.name}. Save to make it the new version.` });
  }

  function save() {
    startTransition(async () => {
      const result = await saveRubric(battlefieldId, body);
      setMessage(
        result.error ? { text: result.error, error: true } : { text: result.saved ?? "Saved." }
      );
    });
  }

  return (
    <div>
      <p className="mb-2 text-sm text-gray-500">
        {active
          ? `Editing the active rubric, v${active.version}. Saving creates v${
              rubrics[0].version + 1
            } and leaves v${active.version} in the history. Jobs graded under an older version keep their grade until you re-rank.`
          : "No rubric yet. Write one or upload a file, then save it as v0."}
      </p>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={18}
        className="w-full rounded-md border border-gray-200 p-3 font-mono text-[13px] leading-relaxed"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save as new version"}
        </button>
        <label className="cursor-pointer text-sm text-gray-500 underline hover:text-gray-900">
          Upload .txt or .md
          <input
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            className="hidden"
            onChange={(e) => {
              loadFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {message ? (
          <span className={`text-sm ${message.error ? "text-red-700" : "text-gray-600"}`}>
            {message.text}
          </span>
        ) : null}
      </div>

      {rubrics.length > 0 ? (
        <div className="mt-6">
          <div className={heading}>History</div>
          <ul className="border-t border-gray-100">
            {rubrics.map((r) => (
              <li key={r.id} className="border-b border-gray-100 py-2 text-sm">
                <div className="flex items-center gap-3">
                  <span className="w-8 font-medium">v{r.version}</span>
                  {r.active ? (
                    <span className="rounded-full bg-green-100 px-2 text-xs text-green-800">
                      active
                    </span>
                  ) : null}
                  <span className="text-gray-500">
                    {r.createdOn} - {r.grades} {r.grades === 1 ? "grade" : "grades"}
                  </span>
                  <button
                    onClick={() => setViewing(viewing === r.id ? null : r.id)}
                    className="ml-auto text-gray-500 underline hover:text-gray-900"
                  >
                    {viewing === r.id ? "Hide" : "View"}
                  </button>
                </div>
                {viewing === r.id ? (
                  <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-[12px] text-gray-600">
                    {r.body}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default function Settings({
  battlefield,
  rubrics,
}: {
  battlefield: Battlefield;
  rubrics: RubricVersion[];
}) {
  const [archiving, startArchive] = useTransition();
  const locationCount = Math.max(battlefield.locations.length, 1);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href={`/?battlefield=${battlefield.slug}`}
        className="text-sm text-gray-500 hover:text-gray-900"
      >
        &larr; {battlefield.name}
      </Link>
      <h1 className="mb-6 mt-3 text-xl font-medium">
        {battlefield.name} settings
        {battlefield.archived ? (
          <span className="ml-3 rounded-full bg-amber-100 px-2 py-0.5 align-middle text-xs text-amber-800">
            archived
          </span>
        ) : null}
      </h1>

      <section className="mb-10">
        <div className={heading}>Search</div>
        <BattlefieldForm
          action={updateBattlefield.bind(null, battlefield.id)}
          defaults={battlefield}
          submitLabel="Save search settings"
        />
      </section>

      <section className="mb-10 space-y-3">
        <div className={heading}>Automation</div>
        <Switch
          battlefieldId={battlefield.id}
          field="autoPopulate"
          initial={battlefield.autoPopulate}
          title="Auto-Populate"
        >
          Re-runs this Battlefield&apos;s search on a schedule. Every run is billed by Apify per
          job returned, up to {battlefield.maxJobs * locationCount} jobs a run at the current caps.
          Nothing is scheduled yet: this switch takes effect once the scheduled job is set up at
          deploy.
        </Switch>
        <Switch
          battlefieldId={battlefield.id}
          field="autoRank"
          initial={battlefield.autoRank}
          title="Auto-Rank"
        >
          After each search, sends only the new jobs to Claude Haiku for grading. Roughly a third
          of a cent per job, so up to about ${((battlefield.maxJobs * locationCount * 0.35) / 100).toFixed(2)}{" "}
          per search at the current caps.
        </Switch>
      </section>

      <section className="mb-10">
        <div className={heading}>Rubric</div>
        <RubricEditor battlefieldId={battlefield.id} rubrics={rubrics} />
      </section>

      <section className="border-t border-gray-200 pt-6">
        <button
          onClick={() => startArchive(() => setArchived(battlefield.id, !battlefield.archived))}
          disabled={archiving}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:border-gray-500 disabled:opacity-50"
        >
          {battlefield.archived ? "Restore Battlefield" : "Archive Battlefield"}
        </button>
        <p className="mt-2 text-xs text-gray-400">
          {battlefield.archived
            ? "Brings it back into the Battlefield switcher."
            : "Hides it from the switcher. Its jobs, grades and applications are kept, and you can restore it later."}
        </p>
      </section>
    </main>
  );
}
