# KAMUI

A personal job-search system. It searches company career sites for postings, has an
LLM judge grade each one against a versioned rubric, and tracks applications through
a pipeline. Everything is organised into Battlefields: self-contained search worlds,
each with its own keywords, locations, caps, rubric and jobs.

## Architecture

One Next.js app and one Postgres database, deployed on Railway as three services:

- **web** — `web/`, Next.js (App Router) + TypeScript + Tailwind. The UI, plus API
  routes that search for jobs (Apify) and rank them (Anthropic). Talks to the
  database through Prisma.
- **sweep** — a Railway cron service from the same repo. Every 5 minutes it runs
  `scripts/sweep.mjs`, which POSTs to web's `/api/runs/sweep` so finished searches
  are saved even when nobody has the app open, then exits.
- **Postgres** — Prisma owns the schema at `prisma/schema.prisma` (repo root).

## Deployment

- Railway auto-deploys from GitHub on every push to `main`. The web service
  rebuilds on any push, including docs-only ones, unless Watch Paths are set on it.
  The sweep service only redeploys when `scripts/sweep.mjs` or
  `railway/sweep-cron.json` change (watchPatterns in its config).
- **Pushing never runs database migrations.** Apply them from the repo root with
  `npx prisma migrate deploy` (it targets the Railway database in `.env`), before
  pushing code that depends on them. Additive migrations are safe to apply early.
- Railway builds from the repo root: the root `package.json` `build` script installs
  `web/` dependencies (with `--include=dev`, since Tailwind, TypeScript and the Prisma
  CLI are devDependencies) and runs web's build; `start` runs `next start` in `web/`,
  which listens on `PORT`.
- **web** variables: `DATABASE_URL`, `APIFY_TOKEN`, `ANTHROPIC_API_KEY`, `CRON_SECRET`.
- **sweep** settings: config file path `/railway/sweep-cron.json` (it sets the start
  command and the `*/5 * * * *` schedule). Variables: `SWEEP_URL` =
  `https://<web's public domain>/api/runs/sweep` and the same `CRON_SECRET` as web.
  Its logs should show `sweep 200` every 5 minutes; `sweep 401` means the secrets
  differ.
- Never add a root `railway.json`: the web service reads it by default and would
  turn into a cron.

## Data model

- **Battlefield** — keywords (`titleIncludes`), `titleExcludes`, `locations`, caps
  (`maxBoards`, `maxJobs`, `maxJobsPerBoard`), and the `autoPopulate` / `autoRank`
  switches, both off by default. `archived` hides it from the switcher.
- **Job** — one row per posting per Battlefield. `atsJobId` is the ATS job id; dedup
  is per Battlefield on `@@unique([battlefieldId, atsJobId])`, so the same posting can
  live in two Battlefields. `battlefieldId` is null for jobs that only exist in an
  Explore SearchWave. `lastSeenAt` is bumped whenever a search re-finds the job. Also
  `closed`/`closedAt`, `dismissed`, and the full `raw` payload. Jobs from before the
  Battlefield migration keep their old ATS id as their `id`; newer jobs get a cuid.
- **Rubric** — the grading sheet, versioned per Battlefield. Only one is `active` at a
  time. Editing never overwrites: it inserts the next version, activates it and
  deactivates the old one.
- **Judgment** — one grade per job per rubric, `@@unique([jobId, rubricId])`. A job
  already graded under the active rubric is never re-sent to the model unless the
  user asks for a re-rank.
- **Application** — the user's status for a job (one row per job).
- **StatusNote** — one note per job per stage, `@@unique([jobId, stage])`.
- **SearchWave** — one saved Explore search and its jobs, so it can be revisited
  without paying for it again.
- **Run** — an audit row for every search and rank, so spend is visible. A search
  Run holds its Apify run ids (`apifyRunIds`, one per location), its Battlefield or
  (for Explore) its `searchWaveId`, and `heartbeatAt`. Status:
  running -> ingesting -> done | failed.

## Key conventions

- **Every automation defaults to OFF.** Searching and ranking cost money, so they
  only run when the user clicks Search New / Rank / Explore's Search, or turns on
  Auto-Populate / Auto-Rank for a Battlefield. A ranked job stays ranked.
- **Every route that costs money writes a Run row.**
- **Battlefields** are created, edited and archived in the UI (`/battlefields/new`,
  `/battlefields/<slug>/settings`). Pages pick one with `?battlefield=<slug>`,
  falling back to the oldest non-archived one. Slugs never change after creation.
- **Grades shown**: the judgment under the active rubric, else the newest one from an
  older version (labelled with its rubric version).
- **Stages**: Aim, Applied, Screening, Interview, Offer, Rejected, Dropped.
  Everything from Applied onward is hidden from Discovery but still counted.
- **Job closure**: never infer that a job closed because a search did not return it
  (searches are capped). Closure is only set by the on-demand URL check when a job is
  opened, and a job with an Application is never auto-hidden or deleted.
- **Every screen is two files**: a `page.tsx` server component that queries the
  database, and a client component that handles interaction. Database access stays
  on the server.
- **Post-mortem log**: `docs/KAMUI-postmortem.docx` records every phase and change
  (what changed, decisions and spec deviations, problems found, verification, risks,
  production data changes) plus a symptom lookup and open issues. After each phase
  or significant change, add its entry to `docs/postmortem/build.mjs` (plus GOTCHAS /
  OPEN_ISSUES if needed) and run `node build.mjs` in that folder (`npm install` there
  first on a fresh clone).

## Search pipeline

No request ever waits for Apify (Railway times long requests out).

1. `POST /api/battlefields/<id>/search` or `POST /api/explore` creates a Run (and,
   for Explore, the SearchWave), starts one Apify run per location with
   apify-client's `start()`, stores the run ids and returns 202 with the Run id. A
   second Search New while one is running returns the running Run.
2. `GET /api/runs/<id>` reports Apify's progress messages. Once every Apify run has
   finished, the first caller claims the Run (running -> ingesting, stamping
   `heartbeatAt`), saves the jobs and marks it done or failed. Only one caller can
   claim, so concurrent polls never save twice. The UI polls this every 5 seconds to
   show progress and resumes after a reload.
3. `POST /api/runs/sweep` (header `Authorization: Bearer $CRON_SECRET`, else 401),
   called by the sweep cron every 5 minutes, runs the same check on every running
   search, so saving never depends on a browser.
4. While saving, the saver re-stamps `heartbeatAt` every 5 seconds. The sweep hands a
   Run back to running only if it is ingesting with a stamp over 2 minutes old (or
   none), so a crashed save is retried and a slow one is never reclaimed. Explore
   saves replace the wave's rows, so a retry cannot duplicate them.
5. If the Battlefield has Auto-Rank on, the new jobs are ranked in `after()`, once
   the response has been sent.

Rank (`POST /api/battlefields/<id>/rank`) is still synchronous: it grades inside the
request, five jobs at a time.

## Files

    prisma/schema.prisma        the single source of truth for the schema
    prisma/migrations/          hand-written SQL, applied with prisma migrate deploy
    package.json                root: Prisma CLI, plus Railway build/start for web/
    scripts/sweep.mjs           the sweep cron's command: POSTs to SWEEP_URL, then exits
    railway/sweep-cron.json     the sweep service's Railway config (every 5 minutes)
    docs/KAMUI-postmortem.docx  post-mortem log (generated by docs/postmortem/build.mjs)
    kamui-rebuild-spec.md       the Battlefields rebuild spec (Phases 1-4)

    web/lib/prisma.ts           Prisma client (needs the @prisma/adapter-pg driver adapter)
    web/lib/apify.ts            apify-client: start runs, check runs, read datasets
    web/lib/searchRuns.ts       start search / explore, checkRun, ingest + heartbeat, sweep
    web/lib/jobs.ts             maps actor items to Job rows, per-Battlefield dedup
    web/lib/rank.ts             the judge: grades jobs against the active rubric
    web/lib/battlefields.ts     slugs, resolveBattlefield (?battlefield=), pickJudgment
    web/lib/waves.ts            waveJobs, copyWaveJobs (promote a wave into a Battlefield)

    web/app/api/battlefields/[id]/search        POST  start a search -> { runId } (202)
    web/app/api/battlefields/[id]/rank          POST  { rerank? } grade unranked jobs
    web/app/api/battlefields/[id]/rank-preview  GET   { unranked, alreadyRanked }
    web/app/api/explore                         POST  { query, locations } -> { runId, waveId } (202)
    web/app/api/explore/waves/[id]/promote      POST  copy a wave into a Battlefield
    web/app/api/runs/[id]                       GET   search progress; saves when Apify is done
    web/app/api/runs/sweep                      POST  save every finished search (Bearer CRON_SECRET)
    web/app/api/jobs/[id]/check-closed          GET   on-demand closed check
    (Battlefield routes accept an id or a slug)

    web/app/page.tsx            Discovery (server)
    web/app/JobBoard.tsx        Discovery (client): sort/filter, dismiss, closed check
    web/app/Toolbar.tsx         Search New (polls the Run) and Rank (with rank-preview confirmation)
    web/app/useRunStatus.ts     client hook that polls /api/runs/<id>
    web/app/actions.ts          server actions: setStatus, saveNote, dismissJob
    web/app/BattlefieldSwitch.tsx       switcher, reads Battlefields from the database
    web/app/battlefields/actions.ts     create/update Battlefield, toggles, saveRubric, archive
    web/app/battlefields/BattlefieldForm.tsx       shared create/edit form
    web/app/battlefields/new/page.tsx              New Battlefield (+ restore archived, ?fromWave=)
    web/app/battlefields/[slug]/settings/page.tsx  Settings (server)
    web/app/battlefields/[slug]/settings/Settings.tsx  Settings (client): toggles, rubric editor
    web/app/explore/page.tsx    Explore (server): holding bay of saved waves, ?wave=<id>
    web/app/explore/Explore.tsx Explore (client): search form, wave progress, promote
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
- `prisma migrate dev` refuses to run in a non-interactive shell. Write the migration
  SQL by hand (`prisma migrate diff` drafts it) and apply it with `prisma migrate deploy`.
- Local work uses Railway's **public** database URL (the `.proxy.rlwy.net` one).
  The internal `postgres.railway.internal` address only works from inside Railway.
- `.env` at the repo root holds `DATABASE_URL`, `APIFY_TOKEN`, `ANTHROPIC_API_KEY`
  (read by the Prisma CLI). `web/.env` needs those plus `CRON_SECRET`, since Next.js
  only reads env files from `web/`. Both are gitignored, never commit them. The root
  `.env` has no final newline, so appending to a copy of it with `echo >>` glues the
  new line onto the last key.
- Without the root `build`/`start` scripts, Railway runs `node index.js` and crashes
  with "Cannot find module '/app/index.js'".
- After changing the schema, restart `next dev`: it caches the old Prisma client.
- In some sandboxed shells `next dev` (Turbopack) panics with 0xc0000142 when it
  spawns the PostCSS worker. `npx next dev --webpack` works around it.

## Sourcing

The Apify actor is `jharney/career-site-jobs-api`, chosen because it searches all
indexed career sites with no company list (`mode: "search"`) AND can return full
descriptions (`includeDescription: true`), which the judge needs.

Input keys used: `mode`, `query` (all words must be in the title; Explore),
`titleIncludes` (any phrase; Battlefields), `titleExcludes`, `location` (a single
string, so one actor run per location), `includeDescription`, `maxBoards`, `maxJobs`,
`maxJobsPerBoard`. A 500-board sweep takes a few minutes. Explore uses fixed small
caps (500 / 50 / 10). `apify-client` is listed in `serverExternalPackages` in
`web/next.config.ts`.

## Judge

Model: `claude-haiku-4-5`. It reads the Battlefield's active rubric plus the job's
title and description, and returns JSON: `grade` (Fit / Possible / Improbable /
Unfit), `score` (0-100), `reason` (one sentence), `key_gap`.

One call per job, five at a time. Dismissed and closed jobs are never sent. The
Message Batches API is the planned upgrade once volume justifies it (50% cheaper, up
to 24h turnaround).

## History

- `kamui-rebuild-spec.md` Phases 1-4 are built: Battlefield schema, search and
  ranking moved into the web app (the Python worker was retired), the Battlefield
  management UI, and Explore with its holding bay.
- Revisions since the spec: Railway root build/start scripts; asynchronous searches
  with a status route; the server-side sweep route and cron; heartbeat recovery for
  saves that die mid-ingest. Details, commits and test evidence for each are in
  `docs/KAMUI-postmortem.docx`.

## Still to build

1. Auto-Populate: the switch is stored but nothing runs it. It needs a scheduled
   caller (like the sweep cron) that starts searches for Battlefields with it on.
2. Rank is still synchronous; ranking hundreds of jobs could time out on Railway.
   It needs the same start / status / sweep split as search.
3. Sourcing: B2B content roles barely appear in the actor's index, and AI/ML
   searches surface mostly Senior and Staff roles.
4. The B2B rubric contradicts itself on senior individual-contributor roles
   (Fit vs Possible).
5. Optional: Watch Paths on the web service so docs-only pushes do not rebuild it.
