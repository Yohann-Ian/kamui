"use client";

// Battlefield settings: search fields, the two automation switches, the
// versioned rubric editor, and archive. Same shell and patterns: glass cards,
// white text, list rows for the rubric history.

import { useState, useTransition } from "react";
import BattlefieldForm, { type SearchFields } from "../../BattlefieldForm";
import { saveRubric, setArchived, setAutomation, updateBattlefield } from "../../actions";
import { CardLabel, btnPrimary, btnSecondary, field } from "../../../shell/ui";

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

const errorMark = "font-semibold underline decoration-grade-unfit decoration-2 underline-offset-4";

function Switch({
  battlefieldId,
  field: name,
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
    <label className="flex cursor-pointer gap-3 rounded-row px-1 py-2 hover:bg-row-selected">
      <input
        type="checkbox"
        checked={on}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          setOn(next);
          startTransition(() => setAutomation(battlefieldId, name, next));
        }}
        className="mt-1 size-4 shrink-0 accent-autumn-deep"
      />
      <div>
        <div className="text-item font-semibold">
          {title}: {on ? "On" : "Off"}
          <span className="ml-2 text-label font-medium opacity-85">off by default</span>
        </div>
        <p className="mt-1 text-meta leading-[1.5] font-medium">{children}</p>
      </div>
    </label>
  );
}

function RubricEditor({ battlefieldId, rubrics }: { battlefieldId: string; rubrics: RubricVersion[] }) {
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
      setMessage(result.error ? { text: result.error, error: true } : { text: result.saved ?? "Saved." });
    });
  }

  return (
    <div>
      <p className="mt-2 mb-3 text-meta leading-[1.5] font-medium">
        {active
          ? `Editing the active rubric, v${active.version}. Saving creates v${
              rubrics[0].version + 1
            } and leaves v${active.version} in the history. Jobs graded under an older version keep their grade until you re-rank.`
          : "No rubric yet. Write one or upload a file, then save it as v0."}
      </p>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={16}
        aria-label="Rubric"
        className={`${field} panel-scroll w-full leading-[1.55]`}
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={pending} className={btnPrimary}>
          {pending ? "Saving..." : "Save as new version"}
        </button>
        <label className={`${btnSecondary} cursor-pointer`}>
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
          <span className={`text-meta ${message.error ? errorMark : "font-medium"}`}>{message.text}</span>
        ) : null}
      </div>

      {rubrics.length > 0 ? (
        <div className="mt-5">
          <CardLabel className="pb-1.5">History</CardLabel>
          <ul>
            {rubrics.map((r) => (
              <li key={r.id}>
                <div
                  className={`flex items-center gap-[0.8125rem] rounded-row px-3 py-[0.5625rem] ${
                    viewing === r.id ? "bg-row-selected" : ""
                  }`}
                >
                  <span className="w-7 shrink-0 text-right font-mono text-score font-medium">v{r.version}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-item leading-[1.35] font-medium">
                      {r.active ? "Active" : "Previous version"}
                    </span>
                    <span className="block text-meta leading-[1.35] font-medium">
                      {r.createdOn} · {r.grades} {r.grades === 1 ? "grade" : "grades"}
                    </span>
                  </span>
                  <button
                    onClick={() => setViewing(viewing === r.id ? null : r.id)}
                    className="shrink-0 text-meta font-semibold underline underline-offset-2"
                  >
                    {viewing === r.id ? "Hide" : "View"}
                  </button>
                </div>
                {viewing === r.id ? (
                  <pre className="panel-scroll mx-3 mt-1 mb-3 max-h-80 overflow-auto rounded-row bg-card p-3 font-ui text-meta leading-[1.55] whitespace-pre-wrap">
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

export default function Settings({ battlefield, rubrics }: { battlefield: Battlefield; rubrics: RubricVersion[] }) {
  const [archiving, startArchive] = useTransition();
  const locationCount = Math.max(battlefield.locations.length, 1);

  return (
    <section className="panel-scroll h-full overflow-y-auto px-6 pt-6 pb-8">
      <h1 className="font-display text-heading font-bold tracking-[-0.015em]">{battlefield.name}</h1>
      <p className="mt-1 text-item font-medium">
        Battlefield settings{battlefield.archived ? ". Archived: hidden from the sidebar." : ""}
      </p>

      <div className="mt-5 flex max-w-[60rem] flex-col gap-4">
        <div className="glass-card px-5 py-[1.125rem]">
          <CardLabel className="pb-4">Search</CardLabel>
          <BattlefieldForm
            action={updateBattlefield.bind(null, battlefield.id)}
            defaults={battlefield}
            submitLabel="Save search settings"
          />
        </div>

        <div className="glass-card px-5 py-[1.125rem]">
          <CardLabel className="pb-2">Automation</CardLabel>
          <Switch
            battlefieldId={battlefield.id}
            field="autoPopulate"
            initial={battlefield.autoPopulate}
            title="Auto-Populate"
          >
            Re-runs this Battlefield&apos;s search on a schedule. Every run is billed by Apify per job
            returned, up to {battlefield.maxJobs * locationCount} jobs a run at the current caps. Nothing
            is scheduled yet: this switch takes effect once the scheduled job is set up.
          </Switch>
          <Switch battlefieldId={battlefield.id} field="autoRank" initial={battlefield.autoRank} title="Auto-Rank">
            After each search, sends only the new jobs to Claude Haiku for grading. Roughly a third of a
            cent per job, so up to about ${((battlefield.maxJobs * locationCount * 0.35) / 100).toFixed(2)} per
            search at the current caps.
          </Switch>
        </div>

        <div className="glass-card px-5 py-[1.125rem]">
          <CardLabel>Rubric</CardLabel>
          <RubricEditor battlefieldId={battlefield.id} rubrics={rubrics} />
        </div>

        <div className="glass-card px-5 py-[1.125rem]">
          <CardLabel className="pb-3">{battlefield.archived ? "Restore" : "Archive"}</CardLabel>
          <button
            onClick={() => startArchive(() => setArchived(battlefield.id, !battlefield.archived))}
            disabled={archiving}
            className={btnSecondary}
          >
            {battlefield.archived ? "Restore Battlefield" : "Archive Battlefield"}
          </button>
          <p className="mt-2 text-meta font-medium">
            {battlefield.archived
              ? "Brings it back into the sidebar."
              : "Hides it from the sidebar. Its jobs, grades and applications are kept, and you can restore it later."}
          </p>
        </div>
      </div>
    </section>
  );
}
