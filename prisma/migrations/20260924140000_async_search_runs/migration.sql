-- Searches no longer wait for Apify inside the request: the search route starts
-- the Apify runs, stores their ids here, and a status route ingests the results.
-- Additive only.

-- AlterTable
ALTER TABLE "Run" ADD COLUMN     "apifyRunIds" TEXT[],
ADD COLUMN     "searchWaveId" TEXT;

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_searchWaveId_fkey" FOREIGN KEY ("searchWaveId") REFERENCES "SearchWave"("id") ON DELETE SET NULL ON UPDATE CASCADE;
