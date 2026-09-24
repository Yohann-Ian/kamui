-- A Run that is ingesting stamps heartbeatAt every few seconds. The sweep hands a
-- Run back to "running" only when its stamp is stale, so a crashed save is retried
-- and a slow one is left alone. Additive only.

-- AlterTable
ALTER TABLE "Run" ADD COLUMN     "heartbeatAt" TIMESTAMP(3);
