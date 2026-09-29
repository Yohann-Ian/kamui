# KAMUI カムイ

My personal job-hunting command centre. It pulls postings straight from company career sites, has an AI grade every one of them against my own rubric, keeps track of every application, and holds every version of every resume I have ever sent. Built by me, for me, and in use every day.

## Why I built this

Job hunting in 2026 is still weirdly scattered. The postings live on thousands of company career sites, each one its own little island. The aggregators show you a slice of them, half of it reposted by agencies, and the other half three weeks stale. There is no single place where I can see everything that fits me, today, and trust it.

Then there are my resumes. I had folders of them. `Resume_final.pdf`, `Resume_final_v2.pdf`, `Resume_final_ACTUAL.pdf`, and one version tailored for an Australian employer that I could never find again when I needed it. Which one did I send to which company? Good question. I had no idea either.

And for tracking, I leaned on LinkedIn's "Saved Jobs". If you have used it, you already know. It is a list. Things go into it and then quietly rot. No stages, no notes, no memory of what you did or why. It saves the job and forgets everything else about it.

That was bad enough for one career. I am juggling two. I am an engineer who builds LLM applications, and I am also a B2B content writer. Different job titles, different resumes, different pitches, different reasons a role is a good fit. LinkedIn wants me to pick one headline and be that person forever. It is 2026 and LinkedIn is still terrible for polymaths.

### Wait, what is a polymath?

Someone who is genuinely good at more than one thing, usually things that do not obviously belong together, and who refuses to be filed under a single label. The classic example is Leonardo da Vinci, who painted the Mona Lisa and then went off to sketch flying machines and dissect anatomy. Benjamin Franklin printed newspapers, ran a post office, helped found a country and flew a kite into a thunderstorm on purpose. Hedy Lamarr was a Hollywood star who co-invented the frequency hopping idea that sits underneath modern wireless. Brian May played guitar in Queen and later finished a PhD in astrophysics.

I am not claiming a seat at that table. I am just saying the world has always had people who do several things well, and the tools we use to find work still pretend we only do one. So I made my own.

### A quick word about this README

Yes, I wrote this readme on purpose like this. Most things these days do not have a soul. Documentation reads like it was assembled by a committee that has never met a human. I like to have fun on my projects, and if I cannot manage that in my own personal space, I would not want to hire me either.

Right. On with the tour.

## What it does

Everything in KAMUI is organised into **Battlefields**. A Battlefield is one career track with its own world: its own search keywords, its own locations, its own grading rubric, its own jobs and its own resumes. I currently run two, AI/ML Engineer and B2B Content, and they never bleed into each other.

- **Search New** sweeps company career sites for my keywords. Under the hood it searches an index of roughly 10,000 company boards (Greenhouse, Lever, Ashby, Workday, SmartRecruiters and friends) and brings back full job descriptions, not just titles.
- **Rank** sends each new job to Claude, which grades it Fit, Possible, Improbable or Unfit against that Battlefield's rubric, gives it a score, a one line reason, and the single biggest gap between me and the role. Grades show up as little coloured dots, because a wall of forty coloured pills is nobody's idea of fun.
- **Rubrics are versioned.** When I realise the judge is being unfair to me, I edit the rubric in the app, it saves as a new version, and I can re-rank everything against the new standard.
- **Explore** is for curiosity. I can run a one-off search for anything, and the results are kept in a holding bay so I never pay to see the same search twice. If something looks promising I can promote it into a Battlefield.
- **Tracking** is the part LinkedIn never gave me: every job I care about moves through Aim, Applied, Screening, Interview, Offer, Rejected or Dropped, with a note at every stage.
- **Resumes** is my resume vault. Pick a Battlefield, pick a resume, pick a version (A, B, C and onwards), and there are the PDF and the Word file side by side, with a note on what makes that version different. I can preview any of them right in the app without downloading anything. It sits behind a password, because resumes are personal.
- **Auto-Populate** can run a Battlefield's search for me once a day, before I wake up, if I switch it on.
- **It looks nice.** A frosted glass panel floats over a photograph, and a little Frost dial lets me decide how see-through it is. There is a button that cycles the background photo. It is a job hunting tool. It does not have to feel like one.

### Nothing spends money unless I say so

Searching costs money per job found. Grading costs money per job graded. So every automation is a switch that starts off, and I climb the ladder myself: create a Battlefield, search it, rank it, and only then decide whether to let it search or rank on its own. Before any ranking happens, KAMUI tells me how many jobs are ungraded and how many already have a grade, and asks first.

## A few things I am proud of

**The judge only ever grades a job once.** A database constraint makes it physically impossible to grade the same job twice under the same rubric, so re-running the ranker costs nothing for anything already done. The nice side effect: a new rubric version is a new rubric, so re-grading everything against it just falls out for free.

**The same job can live in two Battlefields.** An "AI Content Writer" role genuinely belongs in both of my careers, graded two different ways. Deduplication happens per Battlefield, so that works. Changing this meant migrating live data without losing a single grade, application or note.

**Slow searches survive a host that hates slow requests.** A search can take several minutes, and my host cuts long requests off. So a search now starts the work and returns in about a second, the page polls for progress, a small scheduled job saves results even when nobody is watching, and a heartbeat lets a crashed save be retried without ever stealing a slow one from itself. That one took three rounds of "fix it, find the next problem".

**Auto-Populate spends money while I sleep, so it is paranoid on purpose.** Once a day, at 06:00 my time, a tiny Railway cron wakes up and asks the app to search every Battlefield I have switched Auto-Populate on for. It does not trust itself. A Battlefield is skipped if a search for it is already running, so searches never stack. It is skipped if anything searched it in the last 20 hours, manual or automatic, so a cron that fires twice cannot charge me twice. Then it claims the Battlefield in a single database write that only succeeds if nobody else claimed it inside that window, which closes the tiny gap where two fires land in the same instant and both think they are first. If starting the search then fails, it hands the claim back, so a failure never pretends it ran. Each Battlefield runs in its own little bubble, so one bad apple does not stop the rest, and the cron's log lists exactly what was started, what was skipped and why. It only starts the search; the five minute sweep saves the results, and Auto-Rank grades them only if I have switched that on too. I tested it by firing it twice at the same instant. Exactly one search started.

**The resume vault follows the same rule as everything else: the Battlefield comes first.** Every resume lives inside a Battlefield and cannot wander off to another one. Inside it are versions, A, B, C and onwards, and each version has one slot for the PDF and one for the Word file, plus a note on what makes it different ("the Australian one", in my case). A few decisions I am happy with:

- The files are stored in Postgres itself. My host wipes its disk on every redeploy, and a resume vault that forgets your resumes is not much of a vault. Resumes are small, so the database is the boring, durable choice.
- Uploads go through a normal API route rather than a server action, because server actions cap uploads at 1 MB and a designed PDF can easily be bigger. The app also checks the first few bytes of every file, so a PDF has to actually be a PDF and a Word file has to actually be a Word file, whatever its name says.
- Previews happen inside the app. PDFs open in the browser's own viewer, pixel for pixel. Browsers cannot show Word files at all, so those are converted to a clean readable page on the fly and shown in a sandboxed frame that is not allowed to run anything. The preview gets most of the screen, because that is what I am there to read.
- The whole section sits behind a password, because resumes carry my phone number and address. Every page, download, preview and upload checks it on the server, not just the screen. A changed password is stored as a salted hash, never as text. Unlocking sets a signed cookie, and the signature is tied to the current password, so changing the password instantly signs out every other device. Ten wrong guesses and it stops listening for fifteen minutes.

**A missing job is not a closed job.** Searches are capped, so a job that did not come back today usually just was not reached. KAMUI never deletes anything for being absent. It shows me when it last saw a job, and only confirms a closure by checking the posting itself when I open it. Anything I have applied to is never hidden, because that is my hunt history.

## Under the hood

| Piece | What I used |
|---|---|
| App and server | Next.js 16 (App Router) with TypeScript. One service does both the pages and the API. |
| Look and feel | Tailwind, driven by a small design system of my own |
| Database | PostgreSQL through Prisma 7 |
| Job sourcing | An Apify actor that searches company career sites |
| Grading | Claude Haiku, forced to answer in JSON |
| Resume previews | The browser's own PDF viewer, and mammoth to turn Word files into a readable page |
| Resume lock | A salted scrypt password hash and an HMAC-signed cookie, both built on Node's crypto |
| Hosting | Railway: the web app, Postgres, and two tiny cron jobs (one saves finished searches every five minutes, one runs the daily Auto-Populate) |

## Running it yourself

You would need your own Apify and Anthropic accounts, and a Postgres database.

1. Put these in `.env` at the repo root and again in `web/.env`: `DATABASE_URL`, `APIFY_TOKEN`, `ANTHROPIC_API_KEY` and `CRON_SECRET`. Never commit them. The repo already ignores both files.
2. `npm install` at the root, then `npx prisma migrate deploy` to create the tables.
3. `cd web`, `npm install`, `npm run dev`, and open http://localhost:3000.

`CLAUDE.md` has the longer technical notes, and `docs/KAMUI-postmortem.docx` is my running log of every phase: what changed, what broke, and how I checked it.

## How it was built

I designed it: the Battlefield model, the database rules, the rubrics, the "never spend without asking" ladder, the fixes for every failure above, and what the screens show and in what order. I wrote the first version by hand to learn the pieces. Once a single change started touching four files at a time, I brought in Claude Code to do most of the typing, one written spec and one phase at a time, with me checking every result against the database before moving on. It took away the typing, not the thinking.

## What is next

- Ranking still runs inside a single request, so a really big batch could time out. It needs the same start and poll treatment that searching got.
- Sourcing needs tuning. My AI/ML keywords mostly surface senior roles, which the judge rightly grades as long shots, and content writing roles are thin in the index. That is a search problem, not a model problem.

If you have read this far, thank you. Go do the thing you are good at. All of them.
