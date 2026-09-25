-- When the user last opened a Battlefield's Discovery. The homepage counts jobs
-- first seen after it as "new". Null means never opened: every job is new.
-- Additive only.

-- AlterTable
ALTER TABLE "Battlefield" ADD COLUMN     "lastViewedAt" TIMESTAMP(3);
