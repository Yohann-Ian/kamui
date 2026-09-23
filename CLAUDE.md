# KAMUI

A personal job-search system. It pulls job postings from company ATS boards, has an
LLM judge grade each one against a versioned rubric, and tracks applications through
a pipeline.

## Architecture

Three parts around one Postgres database on Railway.

- `worker/` — Python. Fetches jobs and judges them. Talks to Postgres with psycopg
  and raw SQL. Does NOT run migrations.
- `web/` — Next.js (App Router) + TypeScript + Tailwind. Reads and writes the same
  database through Prisma.
- Postgres on Railway. Prisma owns the schema at `prisma/schema.prisma` (repo root).

## Data model

- **Job** — one row per posting. `id` is the stable ATS job id, which is what makes
  dedup work (`ON CONFLICT (id) DO NOTHING` on insert). Has `track`, `description`,
  `locationBin`, and the full `raw` payload.
- **Rubric** — the grading sheet, versioned per track. Only one is `active` per track
  at a time. Swapping rubrics means deactivating the old and activating the new.
- **Judgment** — one grade per job per rubric, enforced by `@@unique([jobId, rubricId])`.
  This is the judge-once rule: a job already graded under the active rubric is never
  re-sent to the model.
- **Application** — the user's status for a job (one row per job).
- **StatusNote** — one note per job per stage, `@@unique([jobId, stage])`.
- **Batch** — reserved for the Anthropic Message Batches API, not used yet.

## Key conventions

- **Tracks (called "Battlefields" in the UI)**: `ai-ml` and `b2b-content`. Each track
  has its own rubric and its own job list. The UI switches track via a `?track=` URL
  search param.
- **Stages**: Aim, Applied, Screening, Interview, Offer, Rejected, Dropped.
  Everything from Applied onward is hidden from Discovery but still counted.
- **Auto-rank**: jobs are judged automatically after fetch. There is no manual
  "queue for ranking" step.
- **Every screen is two files**: a `page.tsx` server component that queries the
  database, and a client component that handles interaction. Database access stays
  on the server.

## Files

    prisma/schema.prisma        the single source of truth for the schema
    worker/fetch.py <track>     runs the Apify actor, writes jobs to Postgres
    worker/judge.py <track>     grades ungraded jobs with Claude Haiku
    worker/load_rubric.py <track>  loads rubrics/<track>.txt as the next version and activates it
    worker/rubrics/             one rubric file per track (ai-ml.txt, b2b-content.txt)
    web/lib/prisma.ts           Prisma client (needs the @prisma/adapter-pg driver adapter)
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
- `.env` at the repo root holds `DATABASE_URL`, `APIFY_TOKEN`, `ANTHROPIC_API_KEY`.
  `web/.env` holds its own copy of `DATABASE_URL`. Both are gitignored, never commit them.

## Sourcing

The Apify actor is `jharney/career-site-jobs-api`, chosen because it searches all
indexed career sites with no company list (`mode: "search"`) AND can return full
descriptions (`includeDescription: true`), which the judge needs.

Input keys: `mode`, `titleIncludes`, `location` (a single string), `includeDescription`,
`maxBoards`, `maxJobs`, `maxJobsPerBoard`.

Known issue, not yet fixed: the current keywords surface almost entirely Senior and
Staff roles, which the judge correctly grades Improbable. The fetch needs tuning to
surface junior and mid roles.

## Judge

Model: `claude-haiku-4-5`. It reads the active rubric for the track plus the job's
title and description, and returns forced JSON: `grade` (Fit / Possible / Improbable /
Unfit), `score` (0-100), `reason` (one sentence), `key_gap`.

Currently synchronous, one call per job. The Message Batches API is the planned
upgrade once volume justifies it (50% cheaper, up to 24h turnaround).

## Still to build

1. Deploy to Railway as two services (`web` and `worker`) plus the existing Postgres,
   with the worker on a schedule.
2. Tune sourcing for junior and mid roles.
3. Eventually: a SearchConfig table so search keywords and locations are editable
   from the UI rather than hardcoded in `fetch.py`.
