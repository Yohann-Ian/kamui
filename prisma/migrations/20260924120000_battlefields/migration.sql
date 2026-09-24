-- Battlefields replace the hardcoded `track` string.
-- Data-preserving: existing jobs keep their id (so Judgment, Application and
-- StatusNote rows stay attached), the old id is copied into atsJobId, and every
-- job and rubric is attached to the Battlefield matching its old track.
BEGIN;

-- CreateTable
CREATE TABLE "Battlefield" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titleIncludes" TEXT[],
    "titleExcludes" TEXT[],
    "locations" TEXT[],
    "maxBoards" INTEGER NOT NULL DEFAULT 2000,
    "maxJobs" INTEGER NOT NULL DEFAULT 200,
    "maxJobsPerBoard" INTEGER NOT NULL DEFAULT 25,
    "autoPopulate" BOOLEAN NOT NULL DEFAULT false,
    "autoRank" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Battlefield_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchWave" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "locations" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jobCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SearchWave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL,
    "battlefieldId" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "jobsFound" INTEGER NOT NULL DEFAULT 0,
    "jobsNew" INTEGER NOT NULL DEFAULT 0,
    "jobsRanked" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "Run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Battlefield_slug_key" ON "Battlefield"("slug");

-- Seed the two existing tracks as Battlefields, carrying over the search
-- settings and caps that worker/fetch.py used for them.
INSERT INTO "Battlefield" ("id", "name", "slug", "titleIncludes", "titleExcludes", "locations", "maxBoards", "maxJobs", "maxJobsPerBoard")
VALUES
    (gen_random_uuid()::text, 'AI/ML Engineer', 'ai-ml',
     ARRAY['machine learning engineer', 'AI engineer'],
     ARRAY[]::TEXT[], ARRAY['United States'], 500, 50, 10),
    (gen_random_uuid()::text, 'B2B Content', 'b2b-content',
     ARRAY['content writer', 'content marketing', 'content strategist', 'technical content', 'product marketing manager'],
     ARRAY[]::TEXT[], ARRAY['United States'], 500, 50, 10);

-- Job: add the new columns (atsJobId nullable until backfilled)
ALTER TABLE "Job"
ADD COLUMN     "atsJobId" TEXT,
ADD COLUMN     "battlefieldId" TEXT,
ADD COLUMN     "closed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "dismissed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "searchWaveId" TEXT;

UPDATE "Job" j
SET "atsJobId"      = j."id",
    "battlefieldId" = b."id",
    "lastSeenAt"    = j."firstSeen"
FROM "Battlefield" b
WHERE b."slug" = j."track";

-- Rubric: attach to its Battlefield
ALTER TABLE "Rubric" ADD COLUMN "battlefieldId" TEXT;

UPDATE "Rubric" r
SET "battlefieldId" = b."id"
FROM "Battlefield" b
WHERE b."slug" = r."track";

-- Abort (and roll back everything) if any row did not match a Battlefield.
DO $$
DECLARE
    orphan_jobs INTEGER;
    orphan_rubrics INTEGER;
BEGIN
    SELECT count(*) INTO orphan_jobs FROM "Job" WHERE "battlefieldId" IS NULL OR "atsJobId" IS NULL;
    SELECT count(*) INTO orphan_rubrics FROM "Rubric" WHERE "battlefieldId" IS NULL;
    IF orphan_jobs > 0 OR orphan_rubrics > 0 THEN
        RAISE EXCEPTION 'battlefields migration: % jobs and % rubrics have a track with no Battlefield', orphan_jobs, orphan_rubrics;
    END IF;
END $$;

ALTER TABLE "Job" ALTER COLUMN "atsJobId" SET NOT NULL;
ALTER TABLE "Job" DROP COLUMN "track";

ALTER TABLE "Rubric" ALTER COLUMN "battlefieldId" SET NOT NULL;
ALTER TABLE "Rubric" DROP COLUMN "track";

-- DropTable (unused, and empty)
DROP TABLE "Batch";

-- CreateIndex
CREATE UNIQUE INDEX "Job_battlefieldId_atsJobId_key" ON "Job"("battlefieldId", "atsJobId");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_battlefieldId_fkey" FOREIGN KEY ("battlefieldId") REFERENCES "Battlefield"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_searchWaveId_fkey" FOREIGN KEY ("searchWaveId") REFERENCES "SearchWave"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rubric" ADD CONSTRAINT "Rubric_battlefieldId_fkey" FOREIGN KEY ("battlefieldId") REFERENCES "Battlefield"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_battlefieldId_fkey" FOREIGN KEY ("battlefieldId") REFERENCES "Battlefield"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
