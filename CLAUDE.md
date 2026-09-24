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
- **Run** — an audit row for every search and rank, so spend is visible.

## Key conventions

- **Battlefields**: `ai-ml` and `b2b-content` so far.
- **Stages**: Aim, Applied, Screening, Interview, Offer, Rejected, Dropped.
  Everything from Applied onward is hidden from Discovery but still counted.
- **Every automation defaults to OFF.** Searching and ranking both cost money, so
  they only run when the user clicks Search New / Rank, or turns on Auto-Populate /
  Auto-Rank for a Battlefield. A ranked job stays ranked.
- **Job closure**: never infer that a job closed because a search did not return it
  (searches are capped). Closure is only set by the on-demand URL check, and a job
  with an Application is never auto-hidden or deleted.
- **Every route that costs money writes a Run row.**
- **Every screen is two files**: a `page.tsx` server component that queries the
  database, and a client component that handles interaction. Database access stays
  on the server.

## Files

    prisma/schema.prisma        the single source of truth for the schema
    web/lib/prisma.ts           Prisma client (needs the @prisma/adapter-pg driver adapter)
    web/lib/apify.ts            runs the Apify actor, one run per location
    web/lib/jobs.ts             maps actor items to Job rows, per-Battlefield dedup
    web/lib/rank.ts             the judge: grades jobs against the active rubric
    web/app/api/battlefields/[id]/search        POST  search, save, auto-rank if on
    web/app/api/battlefields/[id]/rank          POST  { rerank? } grade unranked jobs
    web/app/api/battlefields/[id]/rank-preview  GET   { unranked, alreadyRanked }
    web/app/api/explore                         POST  { query, locations } -> SearchWave
    web/app/api/explore/waves/[id]/promote      POST  copy a wave into a Battlefield
    web/app/api/jobs/[id]/check-closed          GET   on-demand closed check
    (Battlefield routes accept an id or a slug)
    web/app/page.tsx            Discovery (server)
    web/app/JobBoard.tsx        Discovery (client)
    web/app/actions.ts          server actions: setStatus, saveNote
    web/app/BattlefieldSwitch.tsx
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
- `prisma migrate dev` refuses to run in a non-interactive shell. Write the migration
  SQL by hand (`prisma migrate diff` drafts it) and apply it with `prisma migrate deploy`.

## Sourcing

The Apify actor is `jharney/career-site-jobs-api`, chosen because it searches all
indexed career sites with no company list (`mode: "search"`) AND can return full
descriptions (`includeDescription: true`), which the judge needs.

Input keys used: `mode`, `query` (all words must be in the title; Explore),
`titleIncludes` (any phrase; Battlefields), `titleExcludes`, `location` (a single
string, so one actor run per location), `includeDescription`, `maxBoards`, `maxJobs`,
`maxJobsPerBoard`. A 500-board sweep takes about six minutes.

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

Follow `kamui-rebuild-spec.md`: Phase 3 (Battlefield management UI) and Phase 4
(Explore and the holding bay). The Discovery and Tracking pages still query the old
`track` column and are broken until Phase 3. After that: redeploy `web` to Railway.
