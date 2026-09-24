# KAMUI

A personal job-search system. It pulls job postings from company ATS boards, has an
LLM judge grade each one against a versioned rubric, and tracks applications through
a pipeline.

## Architecture

Two parts around one Postgres database on Railway.

- `web/` — Next.js (App Router) + TypeScript + Tailwind. The UI, plus API routes that
  search for jobs (Apify) and rank them (Anthropic). Talks to the database through
  Prisma.
- Postgres on Railway. Prisma owns the schema at `prisma/schema.prisma` (repo root).

## Data model

- **Battlefield** — a self-contained search world: its own title keywords, excludes,
  locations, caps, rubric and jobs. Has `autoPopulate` and `autoRank` switches, both
  off by default.
- **Job** — one row per posting per Battlefield. `atsJobId` is the ATS job id, and
  dedup is per Battlefield on `@@unique([battlefieldId, atsJobId])`, so the same
  posting can live in two Battlefields. `battlefieldId` is null for jobs that only
  exist in an Explore SearchWave. `lastSeenAt` is bumped whenever a search re-finds
  the job. Also `closed`/`closedAt`, `dismissed`, and the full `raw` payload. Jobs
  from before the Battlefield migration keep their old ATS id as their `id`; newer
  jobs get a cuid.
- **Rubric** — the grading sheet, versioned per Battlefield. Only one is `active` at a
  time. Editing never overwrites: it inserts the next version, activates it and
  deactivates the old one.
- **Judgment** — one grade per job per rubric, enforced by `@@unique([jobId, rubricId])`.
  This is the judge-once rule: a job already graded under the active rubric is never
  re-sent to the model.
- **Application** — the user's status for a job (one row per job).
- **StatusNote** — one note per job per stage, `@@unique([jobId, stage])`.
- **SearchWave** — one saved Explore search and its jobs, so it can be revisited
  without paying for it again.
- **Run** — an audit row for every search and rank, so spend is visible. A search Run
  holds its Apify run ids (`apifyRunIds`, one per location) and, for Explore, its
  `searchWaveId`. Status: running -> ingesting -> done | failed. While ingesting,
  the saver stamps `heartbeatAt` every 5 seconds; the sweep hands a Run back to
  running only if it is ingesting with a stamp over 2 minutes old (or none), so a
  crashed save is retried and a slow one is never reclaimed.

## Key conventions

- **Battlefields**: created, edited and archived from the UI (`/battlefields/new`,
  `/battlefields/<slug>/settings`). Pages pick one with `?battlefield=<slug>`, falling
  back to the oldest non-archived one. Slugs never change after creation.
- **Grades shown**: the judgment under the active rubric, else the newest one from an
  older version (labelled with its rubric version).
- **Stages**: Aim, Applied, Screening, Interview, Offer, Rejected, Dropped.
  Everything from Applied onward is hidden from Discovery but still counted.
- **Every automation defaults to OFF.** Searching and ranking both cost money, so
  they only run when the user clicks Search New / Rank, or turns on Auto-Populate /
  Auto-Rank for a Battlefield. A ranked job stays ranked.
- **Job closure**: never infer that a job closed because a search did not return it
  (searches are capped). Closure is only set by the on-demand URL check, and a job
  with an Application is never auto-hidden or deleted.
- **Every route that costs money writes a Run row.**
- **Searches never wait for Apify inside a request** (Railway times long requests
  out). The search and explore routes start the Apify runs and return a Run id at
  once. `GET /api/runs/<id>` reports progress and, on the first call after every Apify
  run has finished, ingests the jobs (it claims the Run with a status update, so
  concurrent callers cannot ingest twice). The UI polls it every 5 seconds to show
  progress. Saving does not depend on the UI: `POST /api/runs/sweep` (guarded by
  `Authorization: Bearer $CRON_SECRET`) runs the same check on every running search,
  and a separate Railway cron service calls it every 5 minutes. Auto-Rank runs in
  `after()` once the response is sent.
- **Post-mortem log**: `docs/KAMUI-postmortem.docx` records every rebuild phase
  (changes, decisions and spec deviations, problems found, verification, risks,
  production data changes). After each phase completes, add its entry to
  `docs/postmortem/build.mjs` (plus GOTCHAS / OPEN_ISSUES if needed) and run
  `node build.mjs` in that folder (`npm install` there first on a fresh clone).
- **Every screen is two files**: a `page.tsx` server component that queries the
  database, and a client component that handles interaction. Database access stays
  on the server.

## Files

    prisma/schema.prisma        the single source of truth for the schema
    web/lib/prisma.ts           Prisma client (needs the @prisma/adapter-pg driver adapter)
    web/lib/apify.ts            apify-client: start runs, check runs, read datasets
    web/lib/searchRuns.ts       start a search / explore, checkRun (progress + one-time ingest)
    web/lib/jobs.ts             maps actor items to Job rows, per-Battlefield dedup
    web/lib/rank.ts             the judge: grades jobs against the active rubric
    web/app/api/battlefields/[id]/search        POST  start a search -> { runId } (202)
    web/app/api/battlefields/[id]/rank          POST  { rerank? } grade unranked jobs
    web/app/api/battlefields/[id]/rank-preview  GET   { unranked, alreadyRanked }
    web/app/api/explore                         POST  { query, locations } -> { runId, waveId } (202)
    web/app/api/runs/[id]                       GET   search progress; ingests when Apify is done
    web/app/api/runs/sweep                      POST  ingest every finished search (Bearer CRON_SECRET)
    scripts/sweep.mjs           the cron service's command: POSTs to SWEEP_URL, then exits
    railway/sweep-cron.json     config for the Railway cron service (every 5 minutes)
    web/app/api/explore/waves/[id]/promote      POST  copy a wave into a Battlefield
    web/app/api/jobs/[id]/check-closed          GET   on-demand closed check
    (Battlefield routes accept an id or a slug)
    web/lib/battlefields.ts     slugs, resolveBattlefield (?battlefield=), pickJudgment
    web/lib/waves.ts            waveJobs, copyWaveJobs (promote a wave into a Battlefield)
    web/app/page.tsx            Discovery (server)
    web/app/JobBoard.tsx        Discovery (client): sort/filter, dismiss, closed check
    web/app/Toolbar.tsx         Search New (polls the Run) and Rank (with rank-preview confirmation)
    web/app/useRunStatus.ts     client hook that polls /api/runs/<id>
    web/app/actions.ts          server actions: setStatus, saveNote, dismissJob
    web/app/BattlefieldSwitch.tsx       switcher, reads Battlefields from the database
    web/app/battlefields/actions.ts     create/update Battlefield, toggles, saveRubric, archive
    web/app/battlefields/BattlefieldForm.tsx       shared create/edit form
    web/app/battlefields/new/page.tsx              New Battlefield (+ restore archived)
    web/app/battlefields/[slug]/settings/page.tsx  Settings (server)
    web/app/battlefields/[slug]/settings/Settings.tsx  Settings (client): toggles, rubric editor
    web/app/explore/page.tsx    Explore (server): holding bay of saved waves, ?wave=<id>
    web/app/explore/Explore.tsx Explore (client): search form, wave jobs, promote
    web/app/tracking/page.tsx           Tracking (server)
    web/app/tracking/TrackingBoard.tsx  Tracking (client)

## Gotchas learned the hard way

- **Prisma must be pinned to v7.** A plain `npm install prisma` pulls the v8
  release candidate, which has no `schema.prisma` or migrate workflow.
- The generated Prisma client must live inside `web/` (generator output is
  `../web/generated/prisma`), and `lib/prisma.ts` imports from
  `../generated/prisma/client`.
- Prisma 7 requires a driver adapter: `PrismaPg` from `@prisma/adapter-pg`, built
  from `DATABASE_URL` and passed as `new PrismaClient({ adapter })`.
- Local work uses Railway's **public** database URL (the `.proxy.rlwy.net` one).
  The internal `postgres.railway.internal` address only works from inside Railway.
- `.env` at the repo root holds `DATABASE_URL`, `APIFY_TOKEN`, `ANTHROPIC_API_KEY`
  (read by the Prisma CLI). `web/.env` needs all three too, since Next.js only reads
  env files from `web/`. Both are gitignored, never commit them.
- In some sandboxed shells `next dev` (Turbopack) panics with 0xc0000142 when it
  spawns the PostCSS worker. `npx next dev --webpack` works around it.
- **Railway builds from the repo root.** The root `package.json` `build` script
  installs `web/` dependencies (with `--include=dev`, since Tailwind, TypeScript and
  the Prisma CLI are devDependencies) and runs `web`'s build; `start` runs
  `next start` in `web/`, which listens on `PORT`. Without these, Railway runs
  `node index.js` and crashes with "Cannot find module '/app/index.js'". The web
  service needs `DATABASE_URL`, `APIFY_TOKEN`, `ANTHROPIC_API_KEY` and `CRON_SECRET`.
- **The sweep cron is its own Railway service** from the same repo, with its config
  file path set to `/railway/sweep-cron.json` (never a root `railway.json`, which the
  web service would pick up and become a cron). It needs `SWEEP_URL`
  (`https://<web domain>/api/runs/sweep`) and the same `CRON_SECRET` as the web service.
- `prisma migrate dev` refuses to run in a non-interactive shell. Write the migration
  SQL by hand (`prisma migrate diff` drafts it) and apply it with `prisma migrate deploy`.

## Sourcing

The Apify actor is `jharney/career-site-jobs-api`, chosen because it searches all
indexed career sites with no company list (`mode: "search"`) AND can return full
descriptions (`includeDescription: true`), which the judge needs.

Input keys used: `mode`, `query` (all words must be in the title; Explore),
`titleIncludes` (any phrase; Battlefields), `titleExcludes`, `location` (a single
string, so one actor run per location), `includeDescription`, `maxBoards`, `maxJobs`,
`maxJobsPerBoard`. A 500-board sweep takes a few minutes. `apify-client` is listed in
`serverExternalPackages` in `web/next.config.ts`.

Known issue, not yet fixed: the current keywords surface almost entirely Senior and
Staff roles, which the judge correctly grades Improbable. The fetch needs tuning to
surface junior and mid roles.

## Judge

Model: `claude-haiku-4-5`. It reads the Battlefield's active rubric plus the job's
title and description, and returns forced JSON: `grade` (Fit / Possible / Improbable /
Unfit), `score` (0-100), `reason` (one sentence), `key_gap`.

One call per job, five at a time. Dismissed and closed jobs are never sent. The
Message Batches API is the planned upgrade once volume justifies it (50% cheaper, up
to 24h turnaround).

## Still to build

All four phases of `kamui-rebuild-spec.md` are built. Next: redeploy `web` to
Railway, including a scheduled job for Auto-Populate, which is stored but not run by
anything yet. See the Open issues list in `docs/KAMUI-postmortem.docx`.
