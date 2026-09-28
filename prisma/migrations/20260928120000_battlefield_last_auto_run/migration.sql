-- When the scheduled Auto-Populate last started a search for a Battlefield, so
-- the homepage can show when it actually fired. Additive only.

-- AlterTable
ALTER TABLE "Battlefield" ADD COLUMN     "lastAutoRunAt" TIMESTAMP(3);
