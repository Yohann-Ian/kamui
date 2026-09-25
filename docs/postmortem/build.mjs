// Builds docs/KAMUI-postmortem.docx, the running post-mortem log of the KAMUI rebuild.
// To update after a phase: add an entry to PHASES (and to OPEN_ISSUES / GOTCHAS
// if needed), then run `node build.mjs` from this folder.
import fs from "node:fs";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

const OUT = new URL("../KAMUI-postmortem.docx", import.meta.url);
const UPDATED = "2026-09-24";
const LATEST = "the design system rebuild";

// ---------------------------------------------------------------- content

const SYSTEM_NOW = [
  "One Next.js app (web/) and one Postgres database on Railway. The Python worker was retired in Phase 2.",
  "Prisma 7 owns the schema (prisma/schema.prisma). The generated client lives in web/generated/prisma and needs the @prisma/adapter-pg driver adapter.",
  "Searching runs the Apify actor jharney/career-site-jobs-api from web/lib/apify.ts. Ranking calls claude-haiku-4-5 from web/lib/rank.ts. Both run inside API routes under web/app/api/.",
  "Battlefields are the organising unit: each has its own keywords, excludes, locations, caps, versioned rubric and jobs. Pages select one with ?battlefield=<slug>.",
  "The UI follows kamui-design-package/DESIGN-SYSTEM.md: glass panel over a photograph, global sidebar with Frost and a background cycler, everything in rem off a fluid root size. / is the homepage; Discovery is /battlefields/<slug>.",
  "Explore (/explore) runs one-off searches that are saved as SearchWaves (jobs with no Battlefield). A wave can be promoted into a Battlefield; promoted jobs are unranked copies.",
  "Every automation is off by default. Search and Rank only run when the user clicks, or when a Battlefield's Auto-Populate / Auto-Rank switch is on.",
  "Searches are asynchronous: the search and explore routes start Apify and return a Run id; GET /api/runs/<id> reports progress and ingests the jobs once Apify finishes. The UI polls it for progress; a Railway cron service calls POST /api/runs/sweep every 5 minutes so results are saved even when nobody is watching.",
  "Railway builds the repo root; the root package.json build and start scripts delegate to web/. Auto-deploy from GitHub was reconnected by the user after Phase 4.",
];

const PHASES = [
  {
    title: "Before the rebuild: track-aware worker and B2B rubric",
    date: "2026-09-23",
    commit: "f996308",
    summary:
      "The Python worker (fetch.py, judge.py, load_rubric.py) was changed to take a track name on the command line instead of hardcoding ai-ml. Rubrics moved into one text file per track. A B2B content rubric was drafted, then replaced by the user's own version, loaded as b2b-content v0, and the first B2B fetch and judge were run.",
    changes: [
      "fetch.py, judge.py and load_rubric.py took a required track argument. load_rubric.py picked the next version number itself.",
      "Rubric text moved to worker/rubrics/ai-ml.txt and b2b-content.txt. (Both files were deleted with worker/ in Phase 2; the rubric bodies live in the Rubric table.)",
      "B2B search keywords: content writer, content marketing, content strategist, technical content, product marketing manager. \"technical writer\" was dropped because the user's rubric grades documentation roles Unfit.",
    ],
    decisions: [],
    incidents: [
      [
        "The first B2B fetch returned only 3 jobs from 462 career sites.",
        "All 3 matched \"product marketing manager\". The content keywords matched nothing in the actor's 500-site index, which leans towards engineering companies. 38 Workday sites failed with HTTP 429 or 500.",
        "Not fixed. Logged as an open issue (thin B2B sourcing).",
      ],
    ],
    verification: [
      "3 B2B jobs graded: Stripe GTM PMM (Fit 78), Databricks Sr. PMM (Fit 78), Stripe PMM Portfolio Pricing (Possible 62).",
    ],
    risks: [
      "The user's B2B rubric contradicts itself on senior roles: the Fit grade covers \"mid or senior level\", but the Possible grade and a hard rule say a senior individual-contributor role is Possible. The judge followed the Fit reading (Databricks Sr. PMM got Fit 78). Unresolved.",
    ],
    dataChanges: [
      "Inserted Rubric b2b-content v0 (active). Inserted 3 b2b-content jobs and 3 judgments.",
    ],
  },
  {
    title: "Phase 1: Battlefield schema",
    date: "2026-09-24",
    commit: "4b8ee0b",
    summary:
      "Replaced the hardcoded track string with a Battlefield model, made job dedup per Battlefield, added SearchWave and Run, dropped Batch, and migrated the existing production data with nothing lost.",
    changes: [
      "prisma/schema.prisma: new Battlefield, SearchWave and Run models. Job gained atsJobId, battlefieldId, searchWaveId, lastSeenAt, closed, closedAt, dismissed, and @@unique([battlefieldId, atsJobId]). Rubric track replaced by battlefieldId. Batch removed.",
      "prisma/migrations/20260924120000_battlefields/migration.sql: hand-written, data-preserving migration in one transaction.",
    ],
    decisions: [
      [
        "Applied with prisma migrate deploy, not migrate dev",
        "migrate dev refuses to run in a non-interactive shell. Its generated SQL would also have dropped track before copying it anywhere and added NOT NULL columns that existing rows fail.",
        "The migration SQL was drafted with prisma migrate diff, then rewritten by hand.",
      ],
      [
        "Existing jobs kept their old id (the raw ATS id) as primary key",
        "Judgment, Application and StatusNote reference Job.id. Keeping the id meant no foreign keys had to be rewired. New rows get a cuid.",
        "Job ids are now mixed: numeric ATS ids for the 28 pre-migration jobs, cuids for everything after. Code must never assume an id format.",
      ],
      [
        "Job.battlefieldId made optional",
        "Phase 2 saves Explore jobs with no Battlefield.",
        "Nulls do not collide in the (battlefieldId, atsJobId) unique index, so Explore jobs are not deduplicated by the database.",
      ],
      [
        "Seeded Battlefields with the old fetch.py caps (500 boards, 50 jobs, 10 per board)",
        "The spec's defaults (2000 / 200 / 25) would have quadrupled search cost without the user choosing it.",
        "Battlefields created later from the UI get the spec defaults.",
      ],
      [
        "lastSeenAt backfilled from firstSeen",
        "Pre-migration jobs had not been re-seen, so now() would have been wrong.",
        "",
      ],
      [
        "Migration aborts if any job or rubric has no matching Battlefield",
        "A DO block raises an exception, which rolls the whole transaction back.",
        "",
      ],
    ],
    incidents: [
      [
        "Prisma Studio shows no jobs column on Battlefield.",
        "Prisma 7 Studio only shows real database columns, not back-relations.",
        "Filter the Job table by battlefieldId instead.",
      ],
      [
        "The Phase 1 commit landed directly on main.",
        "No branch was created first.",
        "Left as is and pushed at the user's request.",
      ],
    ],
    verification: [
      "prisma migrate diff against the live database returned an empty migration (no drift).",
      "Row counts unchanged: 28 jobs, 2 rubrics, 28 judgments, 2 applications, 1 status note.",
      "25 jobs attached to ai-ml and 3 to b2b-content, each with atsJobId equal to its id. The user confirmed the counts in Prisma Studio.",
      "All 28 judgments point at a job and rubric in the same Battlefield; applications and notes still resolve to their jobs.",
    ],
    risks: [
      "Between Phase 1 and Phase 3 every page and the worker were broken, because they still read the removed track column. Any deployed copy of the web app broke at the moment the migration ran against the shared database.",
      "The pre-migration JSON backup of every table was saved in a session temp folder (kamui-backup-pre-battlefields.json) and may no longer exist.",
    ],
    dataChanges: [
      "Created Battlefields ai-ml (\"AI/ML Engineer\") and b2b-content (\"B2B Content\").",
      "Copied Job.id into atsJobId, attached jobs and rubrics by old track, dropped the track columns and the empty Batch table.",
    ],
  },
  {
    title: "Phase 2: search and ranking move into the web app",
    date: "2026-09-24",
    commit: "f77e652",
    summary:
      "Ported fetch.py and judge.py to TypeScript API routes, added Explore, promote and the closed check, wrote a Run row for every paid call, and deleted worker/.",
    changes: [
      "web/lib/apify.ts: starts the actor over the Apify REST API, polls with waitForFinish=60, reads the dataset. One actor run per location, merged and deduplicated by jobId.",
      "web/lib/jobs.ts: maps actor items to Job rows (same field mapping as fetch.py), getBattlefield (id or slug), saveToBattlefield (bump lastSeenAt on existing, insert new).",
      "web/lib/rank.ts: the judge. Same prompt, model, max_tokens (300) and code-fence stripping JSON parse as judge.py. rankPreview and rankBattlefield.",
      "Routes: POST battlefields/[id]/search, POST battlefields/[id]/rank, GET battlefields/[id]/rank-preview, POST explore, POST explore/waves/[id]/promote, GET jobs/[id]/check-closed.",
      "@anthropic-ai/sdk added to web/. web/.env created as a copy of the root .env (it did not exist, contrary to CLAUDE.md).",
      "worker/ deleted. CLAUDE.md rewritten for the web-only architecture.",
    ],
    decisions: [
      [
        "Apify called over plain fetch, not the apify-client package",
        "About 30 lines, no extra dependency or bundling concerns in Next.js.",
        "web/lib/apify.ts",
      ],
      [
        "One actor run per location, run in parallel",
        "The actor's location input is a single string.",
        "Cost and results scale with the number of locations: up to maxJobs x locations per search.",
      ],
      [
        "Explore uses the actor's query field with fixed caps (500 / 50 / 10)",
        "query means all words must appear in the title, which suits a typed search. Small caps keep exploration cheap.",
        "EXPLORE_CAPS in web/app/api/explore/route.ts",
      ],
      [
        "Ranking grades 5 jobs at a time and skips dismissed and closed jobs",
        "Sequential grading is slow at 200 jobs. Dismissed and closed jobs are not worth paying for.",
        "rank-preview counts use the same filter, so the numbers match.",
      ],
      [
        "Re-rank overwrites the job's judgment under the same rubric",
        "@@unique([jobId, rubricId]) allows only one grade per job per rubric, so the upsert replaces it.",
        "History of grades within one rubric version is not kept.",
      ],
      [
        "Auto-Rank failures are reported in the search response",
        "A failed rank should not make a successful (paid) search look failed.",
        "The search response has a rank field holding either the rank result or an error.",
      ],
      [
        "The closed check only ever sets closed; it never marks a job open again",
        "A flaky or blocked request should not flip state back and forth.",
        "A false positive is permanent unless fixed in the database.",
      ],
    ],
    incidents: [
      [
        "Promoting a wave twice reported 2 skipped jobs for a wave of 1.",
        "Promoted copies were tagged with the wave's searchWaveId, so they counted as members of the wave.",
        "Fixed before commit: promoted copies get no searchWaveId. searchWaveId means \"lives in this wave\".",
      ],
      [
        "The closed check reported a dead Stripe posting as open.",
        "Greenhouse behind a company domain redirects a dead posting to the general careers page, not to ?error=true.",
        "Fixed before commit: a redirect whose final URL no longer contains the job's atsJobId counts as closed (all 28 job URLs contained their id). SmartRecruiters answers a dead posting with HTTP 400, which now also counts.",
      ],
      [
        "After stopping the dev server task, port 3000 was still held.",
        "Stopping the npm wrapper left the node child running.",
        "Stopped the process by id. Environment issue, not an app bug.",
      ],
    ],
    verification: [
      "rank-preview returned 0 unranked / 25 ranked for ai-ml and 0 / 3 for b2b-content. Missing Battlefield and missing query returned clean 404 / 400 errors.",
      "A real B2B search found the same 3 jobs, saved 0 as new, and bumped lastSeenAt on all 3 (per-Battlefield dedup works).",
      "A real Explore search for \"content marketing manager\" saved a wave with 1 job (Abbott).",
      "On a temporary Battlefield: rank graded 1, a second rank graded 0 (ranked stays ranked), rerank graded 1 again, and a missing rubric returned 409.",
      "Every search and rank wrote a Run row with the right counts.",
      "Test cost: 2 Apify runs and 3 Haiku calls.",
    ],
    risks: [
      "A Battlefield search holds its HTTP request open for the whole Apify sweep (about 6 minutes at 500 boards; longer at the spec's 2000-board default). Local dev has no limit, but a hosting platform's request timeout could cut it off. maxDuration is set to 900 seconds; Railway's limit has not been checked.",
      "The closed check is a heuristic. Pages that are JavaScript-rendered (Workday, Ashby) may never show the \"no longer accepting\" text to a plain fetch.",
      "The judge parses the model's JSON from free text, exactly as judge.py did. A malformed reply fails that job, which is counted in the Run's error field.",
    ],
    dataChanges: [
      "Kept: 1 SearchWave (\"content marketing manager\", 1 Abbott job with no Battlefield) and 5 Run rows. The 3 rank Runs from the temporary Battlefield now have battlefieldId null.",
      "Removed: the temporary \"KAMUI Test\" Battlefield, its rubric copy, its job and its judgment.",
    ],
  },
  {
    title: "Phase 3: Battlefield management UI",
    date: "2026-09-24",
    commit: "a2658c7",
    summary:
      "Built the Battlefield switcher, the create form, the settings page (search fields, automation switches, versioned rubric editor, archive), the Discovery toolbar (Search New, Rank with preview), and dismiss / last-seen / closed on job rows. Fixed Discovery and Tracking to query by Battlefield.",
    changes: [
      "web/lib/battlefields.ts: slugify / uniqueSlug, resolveBattlefield (?battlefield= with fallback to the oldest non-archived), pickJudgment, daysSince.",
      "web/app/battlefields/actions.ts: createBattlefield, updateBattlefield, setAutomation, saveRubric (always a new version), setArchived.",
      "web/app/battlefields/new/page.tsx, BattlefieldForm.tsx, [slug]/settings/page.tsx and Settings.tsx.",
      "web/app/Toolbar.tsx (Search New, Rank with preview), JobBoard.tsx rewritten, BattlefieldSwitch.tsx reads the database, page.tsx queries by Battlefield.",
      "web/app/actions.ts gained dismissJob. tracking/page.tsx and TrackingBoard.tsx changed only to query by Battlefield.",
      "Page title changed from the Next.js placeholder to KAMUI.",
    ],
    decisions: [
      [
        "URL parameter renamed from ?track= to ?battlefield=<slug>",
        "The unit is a Battlefield now. Old ?track= links fall back to the first Battlefield.",
        "resolveBattlefield in web/lib/battlefields.ts",
      ],
      [
        "Slugs never change after creation",
        "Renaming a Battlefield must not break bookmarks or links.",
        "The settings form edits the name only.",
      ],
      [
        "Grade shown: active rubric's judgment, else the newest older one, labelled with its version",
        "Spec: ranking is sticky. Saving a new rubric version should not make every job look unranked.",
        "rank-preview still counts those jobs as unranked under the new version.",
      ],
      [
        "New Battlefields default to the spec caps (2000 / 200 / 25)",
        "The spec defines them as defaults.",
        "A new Battlefield's first search can cost roughly 4x an ai-ml search. The form shows the caps before creation.",
      ],
      [
        "Auto-Rank cost shown as roughly a third of a cent per job",
        "Estimate: about 3k input and 100 output tokens per job at Haiku 4.5 prices ($1 / $5 per million).",
        "Not measured against real usage.",
      ],
      [
        "Auto-Populate switch is stored but nothing runs it",
        "There is no scheduler yet; it belongs to deployment.",
        "The switch's description in the UI says so.",
      ],
      [
        "Archive from Settings, restore from the New Battlefield page",
        "Archived Battlefields are hidden from the switcher, so the restore list needs another home.",
        "",
      ],
    ],
    incidents: [
      [
        "After switching Battlefield, the detail panel showed \"Select a job.\"",
        "Client navigation reused JobBoard, so the selected job id from the previous Battlefield persisted. Tracking had the same pre-existing bug.",
        "Fixed before commit: both boards are keyed by Battlefield slug, so they reset on switch.",
      ],
      [
        "next dev (Turbopack) crashed with a panic: node process exited with 0xc0000142 while processing globals.css.",
        "Turbopack could not spawn its PostCSS worker from the agent's background shell. next build (same Tailwind step) succeeded.",
        "Tested with npx next dev --webpack. Recorded in CLAUDE.md. Environment issue, not an app bug.",
      ],
      [
        "React hydration warning on the Tracking notes textarea: style caret-color: transparent.",
        "Injected by headless Edge during automation; the attribute is not in the app's code.",
        "None needed.",
      ],
      [
        "Next.js warns it inferred the workspace root from E:\\CODING\\KAMUI\\package-lock.json.",
        "There are lockfiles at both the repo root (Prisma CLI) and web/.",
        "Not fixed. Could matter for deployment output tracing (outputFileTracingRoot).",
      ],
    ],
    verification: [
      "tsc and eslint clean; next build succeeds.",
      "Headless Edge walkthrough with screenshots: Discovery for both Battlefields, switching, rank preview (cancelled), sort and filter, Settings, create form with validation, empty state, Auto-Rank toggle persisting across reload, rubric v0 then v1 with \"No changes to save\" in between, archive hiding from the switcher and appearing in the restore list, dismiss, and Tracking (2 tracked on ai-ml, 0 on b2b-content).",
      "Search New and the Rank confirm button were not clicked, because they cost money. Their routes were tested in Phase 2.",
    ],
    risks: [
      "The Search New and Rank buttons have not yet been exercised end to end from the UI.",
      "Search New keeps the browser request open for minutes; navigating away abandons the response (the search still finishes on the server and writes its Run row).",
    ],
    dataChanges: [
      "None kept. The test Battlefield \"UI Smoke Test\" and its 2 rubric versions were deleted, and the one job dismissed during the test was restored.",
    ],
  },
  {
    title: "Phase 4: Explore and the holding bay",
    date: "2026-09-24",
    commit: "ca85d2b",
    summary:
      "Built the Explore page (keyword and location search that saves an unranked SearchWave), the holding bay of past waves that reopen from the database at no cost, and promotion of a wave into an existing or new Battlefield.",
    changes: [
      "web/app/explore/page.tsx and Explore.tsx: search form, holding bay list (100 most recent waves), the selected wave's jobs (?wave=<id>, defaulting to the newest), and the promote controls.",
      "web/lib/waves.ts: waveJobs (a wave's own rows: searchWaveId set and battlefieldId null) and copyWaveJobs, moved out of the promote route so the create form can use it too.",
      "web/app/battlefields/new/page.tsx accepts ?fromWave=<id> and pre-fills name, keywords and locations from the wave. createBattlefield copies the wave's jobs in when a hidden fromWave field is present.",
      "Discovery's header links to Explore.",
    ],
    decisions: [
      [
        "\"New Battlefield from this search\" goes through the create form instead of creating one in a single click",
        "The spec asks for the new Battlefield's keywords to be pre-filled from the wave. A pre-filled form lets the user check keywords and caps before anything exists.",
        "The promote route's newBattlefield option still exists but the UI does not use it.",
      ],
      [
        "The new-Battlefield form keeps the spec caps (2000 / 200 / 25), not Explore's small caps",
        "Consistent with any other new Battlefield.",
        "Its first Search New can return up to 200 jobs per location. The caps are visible and editable on the form.",
      ],
      [
        "Explore rows have no closed check, no dismiss and no detail panel",
        "A wave is a snapshot of one paid search, not a working list. The description expands inline and Open posting links out.",
        "Closure and dismissal apply once jobs are promoted into a Battlefield.",
      ],
      [
        "Wave times are shown in UTC",
        "Formatted on the server, so server and browser render the same text.",
        "",
      ],
    ],
    incidents: [
      [
        "The search box is empty again after a search completes.",
        "The page is keyed by wave id, so it remounts when it navigates to the new wave.",
        "Left as is: the query is shown as the wave's heading and in the holding bay.",
      ],
    ],
    verification: [
      "tsc and eslint clean.",
      "Headless Edge walkthrough, no console errors: Explore opens from Discovery and shows the saved wave; its description expands; \"start a new Battlefield\" pre-fills name, keywords and locations and states the job count; creating it lands on a Battlefield holding the wave's job, unranked; sending the same wave to that Battlefield reports 0 copied and 1 already there; a real Explore search appears at the top of the holding bay with its jobs; reopening the older wave shows its job from the database.",
      "The real search for \"content writer\" in the United States returned 2 jobs: RBC Marketing Content Writer & Strategist, and Medtronic Senior Technical Writer (labeling). Cost: 1 Apify run.",
    ],
    risks: [
      "An Explore search blocks its browser tab for several minutes. If the tab is closed or navigates away, the wave is still saved and appears in the holding bay after a refresh.",
      "Jobs are not deduplicated across waves: the same posting found by two Explore searches is stored twice (once per wave).",
    ],
    dataChanges: [
      "Kept: SearchWave \"content writer\" (2 jobs, no Battlefield) and its Run row.",
      "Removed: the test Battlefield \"Explore Promote Test\" and the 1 job copied into it.",
    ],
  },
  {
    title: "After Phase 4: Railway deploy fix and asynchronous searches",
    date: "2026-09-24",
    commit: "140be22, 034cc7d",
    summary:
      "The first Railway deploy after the rebuild crashed, and once it ran, searches timed out because each request waited for the Apify sweep. The deploy was fixed with root build and start scripts. Searches were split in two: the search and explore routes start Apify and return at once, and a status route reports progress and saves the jobs when Apify finishes.",
    changes: [
      "package.json (repo root): build installs web/ dependencies with --include=dev and runs web's build; start runs next start in web/ (140be22).",
      "prisma/migrations/20260924140000_async_search_runs: additive. Run gains apifyRunIds (text[]) and searchWaveId (link to SearchWave).",
      "web/lib/apify.ts rewritten on the apify-client package: startSearch (actor.start, one run per location, Promise.allSettled), getRuns, readJobs.",
      "web/lib/searchRuns.ts (new): startBattlefieldSearch, startExplore, and checkRun, which reports progress or ingests once every Apify run has finished.",
      "POST /api/battlefields/[id]/search and POST /api/explore now return 202 with a runId (and waveId for Explore). New GET /api/runs/[id].",
      "UI: web/app/useRunStatus.ts polls the status route every 5 seconds. The Discovery toolbar and the Explore wave view show elapsed time and Apify's progress message, refresh when done, and resume after a reload. The holding bay marks waves that are searching or failed.",
      "web/next.config.ts: apify-client in serverExternalPackages.",
    ],
    decisions: [
      [
        "The Run stores a list of Apify run ids, not one",
        "A Battlefield with several locations starts one Apify run per location.",
        "The status route waits for all of them before ingesting.",
      ],
      [
        "One status route, /api/runs/[id], for Battlefield searches and Explore",
        "The Run row already knows its Battlefield or wave.",
        "",
      ],
      [
        "Ingestion happens when someone polls, not in a background worker",
        "There is no worker process. The UI polls while a search runs and resumes polling on page load.",
        "If nobody opens the page, results wait in Apify until someone does (see risks).",
      ],
      [
        "The first poll after Apify finishes claims the Run (running to ingesting) before saving",
        "Several tabs can poll at once; without the claim an Explore wave would store its jobs twice.",
        "Other pollers see ingesting and keep polling.",
      ],
      [
        "One running search per Battlefield",
        "A second Search New click would pay for the same sweep twice.",
        "The search route returns the running Run instead.",
      ],
      [
        "Partial failure keeps what succeeded",
        "Results from locations whose Apify run succeeded are paid for.",
        "The Run is done, with the failed runs listed in its error field.",
      ],
      [
        "Explore creates its wave when the search starts; failed waves are kept and marked failed",
        "The holding bay can show a search in progress, and a failure stays visible instead of vanishing.",
        "Waves saved before this change have no linked Run and are treated as done.",
      ],
      [
        "Auto-Rank runs in after() from the status route",
        "Ranking must not hold the status request open either.",
        "The status response says autoRank: started; the rank writes its own Run.",
      ],
    ],
    incidents: [
      [
        "Railway deploy crashed: Cannot find module '/app/index.js'.",
        "Railway builds the repo root. The root package.json only existed for the Prisma CLI: no start script and main set to index.js, so Railway ran node index.js.",
        "Root build and start scripts that delegate to web/ (140be22). Tested from a clean clone with NODE_ENV=production: npm ci, npm run build, npm start on a custom PORT.",
      ],
      [
        "Searches timed out on Railway (reported by the user).",
        "The search route waited for the whole Apify sweep inside the request.",
        "Asynchronous searches (034cc7d).",
      ],
    ],
    verification: [
      "tsc, eslint and next build clean.",
      "API: POST /api/explore returned the run and wave ids immediately; the status route reported 'Scanned 202/500 career sites, 2 matching jobs so far' while Apify ran.",
      "Concurrency: after Apify finished, 5 simultaneous status calls produced exactly one ingest (1 returned done with 3 jobs, 4 returned ingesting); the wave's jobCount (3) matched its stored rows (3).",
      "Browser: Search New on b2b-content showed progress within seconds and locked both buttons; a reload mid-search resumed at 'Scanned 69/500'; it finished with 'Found 3, 0 new, 0 you have already applied to' and refreshed the list. An Explore search opened its wave at once, showed 'searching...' in the holding bay, and filled in 3 jobs when done. No console errors.",
      "Test cost: 3 Apify runs. The deployed Railway app itself was not checked here.",
    ],
    risks: [
      "A Run can stay in ingesting forever if the server dies mid-ingest; nothing resets it. Fix by hand: set its status back to running and poll again.",
      "Results are only saved when someone polls. Apify deletes unnamed run datasets after its retention period, so a search nobody looks at for long enough is lost. The Auto-Populate scheduler must poll the status route.",
      "Manual Rank still grades inside its request (5 at a time). Ranking hundreds of jobs could hit Railway's request timeout.",
    ],
    dataChanges: [
      "Applied migration 20260924140000_async_search_runs (additive).",
      "Kept: Explore waves 'content strategist' (3 jobs) and 'content marketing' (3 jobs), a b2b-content search (3 found, 0 new, lastSeenAt bumped on 3 jobs), and their 3 Run rows.",
    ],
  },
  {
    title: "After Phase 4: server-side sweep cron",
    date: "2026-09-24",
    commit: "c804fa4",
    summary:
      "Search results were saved only when a browser polled the status route, so a search nobody watched never got its jobs. Added POST /api/runs/sweep, which ingests every running search whose Apify runs have finished, protected by CRON_SECRET, and a separate Railway cron service that calls it every 5 minutes.",
    changes: [
      "web/app/api/runs/sweep/route.ts: POST only. Requires Authorization: Bearer <CRON_SECRET> (constant-time compare); returns 401 otherwise, and always when CRON_SECRET is unset.",
      "web/lib/searchRuns.ts: sweepRunningSearches runs checkRun on every Run with status running (same ingest and claim as the status route). autoRankAfter moved here so the sweep and the status route both trigger Auto-Rank.",
      "scripts/sweep.mjs: the cron service's command. POSTs to SWEEP_URL with the secret, logs the response, exits 0 on success and 1 on failure.",
      "railway/sweep-cron.json: config for the cron service (start command node scripts/sweep.mjs, cronSchedule */5 * * * *, restart NEVER, trivial build, watchPatterns limited to the script and config).",
    ],
    decisions: [
      [
        "The status route still ingests when it sees a finished run",
        "Otherwise a watching browser would wait up to 5 minutes for the next sweep. The claim guard makes the two callers safe together.",
        "The sweep is the guarantee; the status route is the fast path.",
      ],
      [
        "The cron is a separate Railway service with its own config file path",
        "Railway cron services must run a command and exit, so the web service cannot be the cron. A root railway.json would be picked up by the web service by default.",
        "The cron service's settings must point at /railway/sweep-cron.json.",
      ],
      [
        "The cron calls the web service over HTTP instead of touching the database itself",
        "One copy of the ingest logic, and Auto-Rank's after() runs on the long-lived web server.",
        "The cron service needs SWEEP_URL and the same CRON_SECRET, and fails if the web service is down.",
      ],
      [
        "Secret sent as Authorization: Bearer",
        "The usual convention for cron callers.",
        "A bare secret without the Bearer prefix is rejected.",
      ],
    ],
    incidents: [
      [
        "Adding CRON_SECRET to web/.env glued it onto the end of the ANTHROPIC_API_KEY line.",
        "web/.env had been copied from the root .env, which has no final newline, and the new line was appended with echo >>.",
        "Split back onto its own line and verified the Anthropic key matches the root .env. Local file only; never committed.",
      ],
    ],
    verification: [
      "tsc and eslint clean; railway/sweep-cron.json parses.",
      "Authorization: no header, a wrong secret, and the secret without Bearer all return 401; GET returns 405; the right secret with nothing running returns checked 0.",
      "End to end: an Explore search for 'technical content' was started and never polled. After Apify finished, the Run was still running with 0 wave rows. Running scripts/sweep.mjs ingested it (Run done, 1 job, wave jobCount 1 = 1 row) and exited 0; a second run found nothing to do; the status route then reported done. With a wrong secret the script got 401 and exited 1.",
      "Test cost: 1 Apify run. The Railway cron service itself was not created or checked here.",
    ],
    risks: [
      "A Run stuck in ingesting (server died mid-ingest) is still not recovered by the sweep, which only looks at running Runs.",
      "If CRON_SECRET differs between the two services, every sweep fails with 401 and saving falls back to browser polling only.",
      "Railway skips a cron execution while the previous one is still running, so one very slow sweep delays the next.",
    ],
    dataChanges: [
      "Kept: Explore wave 'technical content' (1 job) and its Run.",
    ],
  },
  {
    title: "After Phase 4: heartbeat recovery for stuck ingests",
    date: "2026-09-24",
    commit: "e2c8ac5",
    summary:
      "A Run could stay \"ingesting\" forever if the server died mid-save, because the claim that stops two callers saving also blocked any retry. Added a heartbeat: the saver stamps Run.heartbeatAt every 5 seconds, and the sweep hands a Run back to \"running\" only when its stamp is more than 2 minutes old, so a crashed save is retried and a slow one is left alone.",
    changes: [
      "prisma/migrations/20260924160000_run_heartbeat: additive. Run gains heartbeatAt (timestamp, nullable).",
      "web/lib/searchRuns.ts: the claim (running to ingesting) sets heartbeatAt; startHeartbeat re-stamps it every 5 seconds (only while the Run is still ingesting) and stops when the save ends; reclaimStaleIngests resets stale Runs to running; sweepRunningSearches calls it before ingesting.",
      "Explore saves replace the wave's rows (deleteMany, then createMany, in one transaction) instead of appending.",
      "POST /api/runs/sweep reports how many Runs it reclaimed.",
    ],
    decisions: [
      [
        "Heartbeat instead of a fixed timeout",
        "A fixed timeout either reclaims slow saves that are still working or leaves crashed ones stuck for too long.",
        "A save is only reclaimed after 2 minutes without a stamp, however long it has been running.",
      ],
      [
        "A Run ingesting with no heartbeatAt is treated as stale",
        "Every claim now sets the stamp, so a missing one can only come from before this change.",
        "",
      ],
      [
        "Explore saves replace the wave's rows",
        "If a save committed and then its process died before marking the Run done, the retry would otherwise store the jobs twice.",
        "Battlefield saves were already safe through the (battlefieldId, atsJobId) unique index.",
      ],
    ],
    incidents: [
      [
        "During testing, a sweep reported reclaimed=1 while a deliberately slow save was running.",
        "The reclaimed Run was a leftover test Run from the previous scenario whose heartbeat had genuinely gone stale, not the slow save.",
        "Confirmed from finish times: the slow save finished on its own after 2 min 35 s; the leftover was reclaimed and re-saved. Working as designed.",
      ],
    ],
    verification: [
      "tsc and eslint clean; migrate diff empty after applying.",
      "Test Runs pointed at an already finished Apify run (no new Apify cost). One sweep reclaimed and re-saved a Run ingesting with a 5-minute-old stamp and a Run with no stamp, and left a Run with a 30-second-old stamp alone. The stale Run's wave already had 1 row from the dead save and ended with 1, not 2.",
      "Slow save: with a temporary 150-second pause in the save (removed before commit), heartbeatAt stayed 3 to 4 seconds old throughout, a sweep 135 seconds in did not reclaim it, and it finished normally.",
      "All test Runs, waves and jobs were deleted afterwards.",
    ],
    risks: [
      "If the database stops accepting the heartbeat writes for over 2 minutes while the saver itself is still alive, the sweep can start a second save of the same Run. Battlefield saves dedupe and Explore saves replace, so the data stays correct, but jobsNew and Auto-Rank can miss jobs the first save inserted.",
      "A retried Battlefield save counts jobs the dead save already inserted as existing, so they are not reported as new or auto-ranked.",
    ],
    dataChanges: [
      "Applied migration 20260924160000_run_heartbeat (additive). No test data kept.",
    ],
  },
  {
    title: "UI rebuild on the KAMUI design system",
    date: "2026-09-25",
    commit: "e850750, f9d0c0f, bb6e6f9",
    summary:
      "Rebuilt the whole UI to kamui-design-package/DESIGN-SYSTEM.md: a glass panel over a photograph, the global sidebar with Frost controls, self-hosted fonts, a new homepage, and Discovery, Tracking, Explore and settings in the new style. Added user-requested extras: a background cycler over the user's own photographs, and scaling to any screen size (the reference files were fixed at 1440x980 and did not fill a 4K monitor).",
    changes: [
      "Shell in web/app/layout.tsx: fixed photograph, tint, glass panel (frost-panel class reading --frost-* variables), the sidebar (web/app/shell/Sidebar.tsx) and main area. An inline head script (shell/frost.ts bootScript) applies stored Frost and background before first paint.",
      "Design tokens in web/app/globals.css: palette, grade dots, glass fills, the type scale as text-* tokens in rem, radii, widths, panel shadow, hover fill. Fluid root size clamp(15px, min(1.111vw, 1.633vh), 36px).",
      "Fonts in web/app/fonts via next/font: Neutralface (Regular, Bold OTF), Aspekta 400-700 (WOFF2); Noto Sans JP and IBM Plex Mono from next/font/google.",
      "Backgrounds: web/scripts/sync-backgrounds.mjs (npm run backgrounds) resizes <repo>/images to 3840 px progressive JPEGs in web/public/backgrounds (53 MB of originals to 5.3 MB). The sidebar's Next button cycles them; the choice persists in localStorage.",
      "Routes: Discovery moved from / to /battlefields/<slug>; / is the new homepage; /?battlefield=<slug> redirects. BattlefieldSwitch removed (the sidebar replaces it).",
      "Homepage (app/page.tsx, Home.tsx): kana banner, Welcome, new-jobs subhead, one tile per Battlefield with new and applied and last searched. Migration 20260925120000_battlefield_last_viewed adds Battlefield.lastViewedAt, set by Discovery on open (markViewed).",
      "Discovery rebuilt (app/battlefields/[slug]/): header with Rank N and Search New; selected-job card with Open posting, Dismiss, stage buttons and note; Score, Grade and Pay stat cards; Why this grade with the key gap and a description toggle; the job list with grade dots, sort and last-seen filter.",
      "Tracking, Explore, Battlefield settings and New Battlefield restyled per section 9 with the same behaviour.",
    ],
    decisions: [
      [
        "Background images come from <repo>/images, not the package's background-source.jpg",
        "User instruction.",
        "The originals folder is gitignored; only the resized copies are committed.",
      ],
      [
        "Everything sized in rem off a fluid root font size",
        "The user's 4K monitor showed the fixed-pixel reference tiny. Scaling by min(width/1440, height/980) keeps the designed proportions on any screen.",
        "The 15px floor keeps the 11px sizes above 10px on small laptops; the 36px cap stops runaway sizes. Native range-slider thumbs do not scale.",
      ],
      [
        "Where the reference HTML and the spec disagree, the spec wins",
        "The reference uses 10px labels, grey text (#C2CEDA, #F2F6FA) and pastel dots; the spec forbids all three.",
        "Card labels are 11.5px white at 85% opacity; dots use the spec's traffic-light colours.",
      ],
      [
        "Open posting is the primary (autumn) button, not the reference's white button",
        "The spec says dark text on a light ground does not occur.",
        "",
      ],
      [
        "Neutralface only for the wordmark, page headings and Battlefield names",
        "It is an all-caps face; job titles in it were heavy and hard to scan.",
        "The selected job's title uses Aspekta at 21px 600.",
      ],
      [
        "Status, notes, dismiss and description kept on Discovery inside the new layout",
        "Behaviour had to stay intact, and the reference has no detail panel.",
        "Stage buttons and the note sit in the selected card; the description is behind a toggle in Why this grade.",
      ],
      [
        "Pay card only when the posting states a salary",
        "The database has no salary column; 5 of 47 raw payloads carry salaryMin/Max/Currency/Interval.",
        "",
      ],
      [
        "New on the homepage = jobs first seen after Battlefield.lastViewedAt",
        "The prompt required a real number. Null (never opened) counts every job as new.",
        "Jobs promoted from Explore keep the wave's firstSeen, so an old wave promoted later may not count as new.",
      ],
      [
        "Errors are shown in white with a red underline",
        "All text must be white; colour cannot carry the error.",
        "",
      ],
    ],
    incidents: [
      [
        "The first 1366x768 check measured the smallest text at 10.1px.",
        "The root size floor was 14.7px.",
        "Raised the floor to 15px (smallest text 10.3px).",
      ],
      [
        "A test lookup for the background Next button also matched the Next.js dev tools button.",
        "Test-only: getByRole('button', {name: 'Next'}) is a substring match.",
        "Used an exact match.",
      ],
    ],
    verification: [
      "tsc, eslint and next build clean.",
      "Every screen screenshotted at 1366x768, 1440x980, 2560x1440 and 3840x2160: the sidebar fits without scrolling, the page never scrolls, the smallest text is 10.3px or larger, no console errors.",
      "Persistent-profile browser test: Frost set to 17/88/9 and background 3 of 4 survived closing and reopening the browser and were applied at DOMContentLoaded (no flash); a stored View of 95 was clamped to 68; the rank preview opened and was cancelled; the AI/ML tile went from 34 new to 0 after opening its Discovery.",
      "Audit (CLAUDE-CODE-PROMPTS Phase 7): no off-scale font sizes, no non-white text beyond the two allowed exceptions, no hex or rgba in components, no text at 10px or below, no grade pills, Frost on every page via the layout.",
    ],
    risks: [
      "Search New, status changes, notes and dismiss were not clicked in the new UI during testing (they change data or cost money); their code paths are unchanged from before.",
      "Native range-slider thumbs keep the browser's fixed size, so they look small on a 4K screen.",
      "Below about 1100 px wide the fixed sidebar and stat cards crowd the content; phones and tablets are not designed for.",
      "Next.js loads Noto Sans JP without preloading, so the kana can briefly show in a fallback face on first load.",
    ],
    dataChanges: [
      "Applied migration 20260925120000_battlefield_last_viewed (additive).",
      "The browser test opened AI/ML's Discovery, which set its lastViewedAt (its homepage \"new\" count went to 0).",
    ],
  },
];

// Symptom-first lookup for later debugging.
const GOTCHAS = [
  ["A page errors about the column track", "Code written before Phase 1. Query by battlefieldId, and select the Battlefield with ?battlefield=<slug>."],
  ["prisma migrate dev refuses to run", "Non-interactive shell. Draft with prisma migrate diff, write the SQL by hand, apply with prisma migrate deploy."],
  ["A job id is not a cuid", "Jobs from before Phase 1 kept their raw ATS id as primary key. Both formats are valid."],
  ["The same posting appears twice", "Expected across Battlefields (dedup is per Battlefield), and in Explore waves (null battlefieldId never collides)."],
  ["Search returns far fewer jobs than maxJobs", "maxBoards caps how many of the actor's indexed sites are scanned; many Workday sites fail with 429. Absence from a search never means a job closed."],
  ["A job is marked Closed but is live", "The closed check is a heuristic and never unsets closed. Check the job URL; fix the row by hand."],
  ["Rank says 0 unranked after a new rubric version", "It should not: a new version makes every job unranked for that version. Check that saveRubric deactivated the old version."],
  ["Env var missing in the web app", "Next.js only reads web/.env. The root .env is only for the Prisma CLI."],
  ["next dev panics with 0xc0000142", "Turbopack could not spawn its PostCSS worker. Use npx next dev --webpack."],
  ["Railway deploy crashes: Cannot find module '/app/index.js'", "Railway built the repo root, whose package.json had no start script. Fixed on 2026-09-24: root build/start scripts delegate to web/. Check they still exist."],
  ["Railway build fails on tailwind, typescript or prisma not found", "web/ devDependencies were skipped in a production install. The root build script must keep npm ci --include=dev."],
  ["A search shows Saving the results... for minutes", "Its saver died mid-ingest. Once heartbeatAt is over 2 minutes old, the next sweep (every 5 minutes) hands it back to running and saves it again. If it never recovers, check that the sweep cron is running."],
  ["A search finished on Apify but its jobs never appeared", "Check the sweep cron service's logs on Railway. Until the next sweep, opening the Battlefield or wave page (which polls GET /api/runs/<id>) also ingests it."],
  ["The sweep cron logs sweep 401", "CRON_SECRET differs between the web service and the cron service, or the header lacks the Bearer prefix."],
  ["The web service stops serving and runs every 5 minutes instead", "It picked up a cron config: a railway.json at the repo root, or its config file path set to railway/sweep-cron.json. Only the cron service should use that file."],
  ["The UI looks tiny or huge on a new screen", "The root font size is clamp(15px, min(1.111vw, 1.633vh), 36px) in web/app/globals.css; every size is in rem, so adjust that one line."],
  ["Frost or the background resets on every visit", "localStorage is blocked or cleared in that browser. Keys: kamui.frost.view|strength|focus and kamui.background."],
  ["A new background photo does not appear in the cycler", "Put the original in <repo>/images, run npm run backgrounds in web/, and commit web/public/backgrounds."],
  ["Homepage new count looks wrong", "New = jobs with firstSeen after Battlefield.lastViewedAt, set when Discovery opens. Promoted Explore jobs keep the wave's firstSeen."],
  ["Port 3000 already in use", "A previous next dev left its node process running. Stop the process listening on 3000."],
];

const OPEN_ISSUES = [
  "B2B sourcing is thin: 3 jobs from about 460 sites for the B2B Battlefield, and an Explore search for \"content writer\" found only 2. The actor's index has few content roles.",
  "AI/ML sourcing surfaces mostly Senior and Staff roles, which grade Improbable.",
  "The B2B rubric contradicts itself on senior individual-contributor roles (Fit vs Possible).",
  "Auto-Populate has no scheduler.",
  "Manual Rank still runs inside its request; large ranks could time out on Railway.",
  "The Railway sweep cron service has to be created by hand (see CLAUDE.md) and has not been verified on Railway.",
  "The deployed Railway app has not been verified after the deploy fix and the async search change.",
  "Two lockfiles (repo root and web/) make Next.js guess the workspace root.",
  "The Auto-Rank cost estimate is not measured.",
  "Rank has not been clicked from the UI yet (its route was tested directly in Phase 2). Search New has.",
];

// ---------------------------------------------------------------- layout

const FONT = "Calibri";
const CONTENT_WIDTH = 9026; // A4 with 1-inch margins, in DXA
const border = { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" };
const borders = { top: border, bottom: border, left: border, right: border };

const p = (text, opts = {}) =>
  new Paragraph({ spacing: { after: 120 }, ...opts, children: [new TextRun({ text, ...opts.run })] });
const h1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
const bullets = (items) =>
  items.map((t) => new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 }, children: [new TextRun(t)] }));

function table(headers, widths, rows) {
  const cell = (text, width, header) =>
    new TableCell({
      borders,
      width: { size: width, type: WidthType.DXA },
      shading: header ? { fill: "EDEDED", type: ShadingType.CLEAR, color: "auto" } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ children: [new TextRun({ text, bold: header, size: 19 })] })],
    });
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, widths[i], true)) }),
      ...rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, widths[i], false)) })),
    ],
  });
}

const spacer = () => new Paragraph({ spacing: { after: 120 }, children: [] });

function phaseSection(ph) {
  const out = [
    h1(ph.title),
    p(`${ph.date}  ·  commit ${ph.commit}`, { run: { color: "666666", size: 20 } }),
    p(ph.summary),
    h2("What changed"),
    ...bullets(ph.changes),
  ];
  if (ph.decisions.length) {
    out.push(h2("Decisions and deviations from the spec"), table(["Decision", "Why", "Consequence / where"], [2600, 3400, 3026], ph.decisions), spacer());
  }
  if (ph.incidents.length) {
    out.push(h2("Problems found"), table(["Symptom", "Cause", "Resolution"], [2800, 3300, 2926], ph.incidents), spacer());
  }
  out.push(h2("Verification"), ...bullets(ph.verification));
  if (ph.risks.length) out.push(h2("Known risks left behind"), ...bullets(ph.risks));
  out.push(h2("Production data changes"), ...bullets(ph.dataChanges));
  return out;
}

const doc = new Document({
  creator: "Yohann",
  title: "KAMUI rebuild post-mortem",
  styles: {
    default: { document: { run: { font: FONT, size: 21 } } },
    paragraphStyles: [
      {
        id: "Title", name: "Title", basedOn: "Normal",
        run: { size: 40, bold: true, font: FONT },
        paragraph: { spacing: { after: 120 } },
      },
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, font: FONT, color: "1F1F1F" },
        paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0, keepNext: true },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 23, bold: true, font: FONT, color: "404040" },
        paragraph: { spacing: { before: 220, after: 80 }, outlineLevel: 1, keepNext: true },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } },
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ children: ["KAMUI post-mortem  ·  page ", PageNumber.CURRENT], size: 16, color: "808080" })],
            }),
          ],
        }),
      },
      children: [
        new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun("KAMUI rebuild post-mortem")] }),
        p(`Last updated ${UPDATED}, after ${LATEST}.`, { run: { color: "666666" } }),
        p(
          "A running record of each phase of the rebuild described in kamui-rebuild-spec.md: what changed, the decisions that went beyond or against the spec, the problems found along the way, how it was verified, and what was changed in the production database. It is meant as context when debugging product flaws later. The newest phase is last. The content is generated from docs/postmortem/build.mjs."
        ),
        h1("How to use this document"),
        ...bullets([
          "Start with Symptom lookup if you are chasing a specific failure.",
          "Each phase lists its commit. git show <commit> gives the exact code as it was written.",
          "Production data changes records every write made to the Railway database outside normal app use, including test data that was later removed.",
        ]),
        h1(`The system after ${LATEST}`),
        ...bullets(SYSTEM_NOW),
        h1("Symptom lookup"),
        table(["Symptom", "Likely cause and what to do"], [3200, 5826], GOTCHAS),
        h1("Open issues"),
        ...bullets(OPEN_ISSUES),
        ...PHASES.flatMap(phaseSection),
      ],
    },
  ],
});

fs.writeFileSync(OUT, await Packer.toBuffer(doc));
console.log("wrote", OUT.pathname);
