# KAMUI rebuild spec: Battlefields, Explore, and moving the worker into the web app

This replaces the hardcoded-track version of KAMUI. Read CLAUDE.md first for the
existing architecture.

Work in phases. Finish and verify each phase before starting the next. Do not skip
ahead. After each phase, tell me what changed and what to test.

---

## The design philosophy driving all of this

A Battlefield is a self-contained world: its own keywords, its own locations, its own
rubric, its own jobs. Nothing is shared between Battlefields except the job pool's
dedup identity.

Every automation is a switch that defaults to OFF. The user climbs a ladder and
chooses each rung:

    Create Battlefield  ->  Search New  ->  Rank  ->  Auto-Populate ON  ->  Auto-Rank ON

The reason is cost and control. Searching costs money (Apify bills per job result).
Ranking costs money (Anthropic bills per call). The user must never be funnelled into
either automatically. Normal operation is: open a Battlefield, click Search New, see
new jobs appear, click Rank if wanted, apply to things.

Ranking is sticky. Once a job is ranked, it stays ranked. New jobs arriving via
auto-populate are NOT ranked unless the user clicks Rank or Auto-Rank is on.

---

## PHASE 1: Schema

Edit `prisma/schema.prisma`. Then run the migration from the repo root:
`npx prisma migrate dev --name battlefields`, then regenerate the web client:
`cd web && npx prisma generate --schema ../prisma/schema.prisma`.

### New model: Battlefield

Replaces the hardcoded `track` string as the organizing unit.

    model Battlefield {
      id              String   @id @default(cuid())
      name            String                     // "AI/ML Engineer"
      slug            String   @unique           // "ai-ml"
      titleIncludes   String[]                   // keywords to match in job titles
      titleExcludes   String[]                   // keywords that drop a job
      locations       String[]                   // e.g. ["United States", "Remote"]
      maxBoards       Int      @default(2000)
      maxJobs         Int      @default(200)
      maxJobsPerBoard Int      @default(25)
      autoPopulate    Boolean  @default(false)   // scheduled re-search, OFF by default
      autoRank        Boolean  @default(false)   // auto-judge new arrivals, OFF by default
      archived        Boolean  @default(false)
      createdAt       DateTime @default(now())
      jobs            Job[]
      rubrics         Rubric[]
      runs            Run[]
    }

### Changed: Job

- Replace the `track String` field with a relation to Battlefield:
  `battlefield Battlefield @relation(...)` and `battlefieldId String`.
- Add `lastSeenAt DateTime @default(now())`. Update it every time a fetch re-finds
  the job. This is how staleness is tracked. See the closure rules below.
- Add `closed Boolean @default(false)` and `closedAt DateTime?`.
- Add `dismissed Boolean @default(false)` so the user can manually remove a job from
  a Battlefield's view without deleting the row.
- Add `searchWaveId String?` and a relation to SearchWave (nullable, because jobs
  found by a Battlefield search have no wave).

IMPORTANT on `Job.id`: it is currently the raw ATS job id. That breaks now, because
the same posting can legitimately appear in two different Battlefields. Change the
primary key to a cuid, and add:

    atsJobId  String
    @@unique([battlefieldId, atsJobId])

Dedup is now per Battlefield, not global. The existing `ON CONFLICT` logic must be
updated to match on this compound unique instead of the id.

### Changed: Rubric

- Replace `track String` with `battlefieldId String` and the relation.
- Keep `version Int` and `active Boolean`.
- Editing a rubric NEVER overwrites the existing row. It creates a new row with
  `version` incremented, sets it active, and deactivates the previous one. This
  preserves the history of which rubric produced which grade, and it is also what
  makes reranking work: a new rubric version is a new (jobId, rubricId) pair, so the
  judge is allowed to grade the job again.

### Unchanged

`Judgment` keeps `@@unique([jobId, rubricId])`. This is what enforces "ranked stays
ranked" with no extra code. Do not remove it.

`Application`, `StatusNote` stay as they are.

### New model: SearchWave

The Explore holding bay. Every Explore search is a wave, saved so the user can
revisit past searches without paying to re-run them.

    model SearchWave {
      id            String   @id @default(cuid())
      query         String                    // what was typed
      locations     String[]
      createdAt     DateTime @default(now())
      jobCount      Int      @default(0)
      jobs          Job[]
    }

### New model: Run

An audit trail of every search and rank, so cost is visible.

    model Run {
      id             String   @id @default(cuid())
      battlefield    Battlefield? @relation(...)
      battlefieldId  String?
      kind           String                  // "search" | "rank"
      status         String   @default("running")  // running | done | failed
      jobsFound      Int      @default(0)
      jobsNew        Int      @default(0)
      jobsRanked     Int      @default(0)
      error          String?
      startedAt      DateTime @default(now())
      finishedAt     DateTime?
    }

### Drop

The `Batch` model is unused. Remove it.

### Migrating existing data

There are existing rows with `track` values "ai-ml" and "b2b-content", plus their
rubrics, judgments, applications and notes. Write the migration so that:
1. Two Battlefields are created, with those slugs and the names "AI/ML Engineer" and
   "B2B Content".
2. Existing jobs are attached to the matching Battlefield, and their old `id` value
   is copied into the new `atsJobId` column.
3. Existing rubrics are attached to the matching Battlefield.
4. Judgments, Applications and StatusNotes keep pointing at their jobs.

Do not lose data. If the migration cannot preserve it, stop and tell me before
running anything.

---

## PHASE 2: Move fetch and judge into the web app

The Python worker cannot be triggered from a browser, and KAMUI has to work from a
laptop in a hotel, not just the desktop. So the fetching and judging logic moves into
Next.js as API routes, and the Python worker is retired.

Port `worker/fetch.py` and `worker/judge.py` to TypeScript. Keep the logic identical,
including the Apify actor (`jharney/career-site-jobs-api`, mode "search",
includeDescription true) and the judge model (`claude-haiku-4-5`, forced JSON output
of grade / score / reason / key_gap).

Create these routes:

**`POST /api/battlefields/[id]/search`**
- Reads the Battlefield's keywords, locations and caps.
- Creates a Run row with kind "search".
- Calls the Apify actor.
- For each returned job: upsert on `(battlefieldId, atsJobId)`. If it already exists,
  update `lastSeenAt` and nothing else. If it is new, insert it.
- Updates the Run with jobsFound and jobsNew, marks it done.
- If the Battlefield has `autoRank` on, then rank the new jobs afterwards (see below).
- Returns a summary: how many found, how many new, how many already applied to.

**`POST /api/battlefields/[id]/rank`**
- Takes an optional body `{ rerank: boolean }`.
- Finds the Battlefield's active rubric.
- Finds jobs in this Battlefield with no Judgment under that rubric. Those are the
  unranked ones.
- If `rerank` is false (the default), grades only those.
- If `rerank` is true, grades every job in the Battlefield, creating judgments under
  the current active rubric.
- Never re-grades a job that already has a judgment under the active rubric, unless
  rerank is explicitly true.
- Writes a Run row with kind "rank".

**`GET /api/battlefields/[id]/rank-preview`**
- Returns `{ unranked: number, alreadyRanked: number }` so the UI can show the user
  what clicking Rank will do before they commit to paying for it.

**`POST /api/explore`**
- Takes `{ query, locations }`.
- Creates a SearchWave row.
- Runs the same Apify search, but with no Battlefield and no ranking.
- Saves the jobs attached to that wave, with `battlefieldId` null.
- Returns the wave and its jobs.

**`POST /api/explore/waves/[id]/promote`**
- Takes `{ battlefieldId }` or `{ newBattlefield: { name, ... } }`.
- Copies the wave's jobs into that Battlefield (respecting the per-Battlefield dedup).
- Does not rank them.

**`GET /api/jobs/[id]/check-closed`**
- Fetches the job's `url` and checks whether it 404s or redirects to a "no longer
  accepting applications" page.
- Sets `closed` and `closedAt` if so.
- This runs ON DEMAND only, when the user opens a job's detail panel. Never in bulk.

Once these work, delete the `worker/` folder and remove its references from CLAUDE.md.

### Job closure rules, important

Never infer that a job closed because a search did not return it. Searches are capped
by maxBoards and maxJobs, so absence almost always means the sweep did not reach it,
not that the posting died. Deleting on absence would destroy live jobs.

Instead:
- `lastSeenAt` is the only staleness signal. Show it in the UI as plain text
  ("last seen 18 days ago"). Let the user sort and filter by it.
- Real closure is confirmed only by the on-demand URL check above.
- A job that has an Application attached is NEVER auto-deleted, auto-hidden or
  auto-dismissed, no matter how stale or how closed. That is hunt history and it
  outlives the posting.

---

## PHASE 3: Battlefield management UI

All of this lives in the Next.js app. No more editing code to change a search.

**Battlefield list / switcher.** Replace the hardcoded `BattlefieldSwitch` with one
that reads real Battlefields from the database. Include a "New Battlefield" action.

**Create Battlefield.** A form: name, title keywords (a list), title excludes (a
list), locations (a list), and the three caps. Creating it lands the user in a blank
Battlefield with a clear empty state that tells them to click Search New.

**Battlefield settings page.** Everything from the create form, editable. Plus:
- The two toggles, Auto-Populate and Auto-Rank, both clearly showing they are off by
  default and what turning them on will cost.
- The rubric editor. A textarea holding the active rubric's body, with a Save button
  that creates a NEW version rather than overwriting. Show the version number and
  history. Also allow uploading a .txt or .md file to replace the body.
- An Archive button.

**Battlefield toolbar**, on the Discovery view:
- `Search New` button. Runs the search, then reports "Found 143, 12 new, 4 you have
  already applied to."
- `Rank` button. Before running, calls rank-preview and shows a confirmation: "38
  jobs are unranked. 25 already have grades. Rank the 38?" with a secondary option
  "Also re-rank the 25 using the current rubric." Only proceeds on confirmation.
- Both buttons show progress while running and are disabled during a run.

**Job rows** gain a dismiss action, and show `lastSeenAt` quietly. Closed jobs render
struck through or heavily dimmed with a "Closed" marker.

---

## PHASE 4: Explore and the holding bay

**Explore page.** A search box (keywords) plus locations. Hitting Search runs
`/api/explore` and shows the results unranked, in the same row layout as Discovery but
with no score or grade.

**Holding bay.** A list of past SearchWaves with their query, date and job count.
Clicking one shows its jobs again, read from the database, with no new Apify call and
therefore no cost. This is the whole point: searches are paid for, so they are kept.

**Promote.** From a wave, the user can send its jobs into an existing Battlefield, or
create a new Battlefield seeded from that wave (pre-filling the new Battlefield's
keywords with the wave's query).

---

## Constraints

- Do not change anything about the Application or StatusNote behaviour. The tracking
  flow works and is not part of this rebuild.
- Keep the existing two-file pattern for screens: a `page.tsx` server component that
  queries the database, and a client component for interaction.
- Prisma stays pinned at 7. Do not upgrade to 8.
- The generated Prisma client stays inside `web/`.
- Every API route that costs money (search, rank, explore) must write a Run row, so
  spend is auditable.
- Commit after each phase with a clear message.
