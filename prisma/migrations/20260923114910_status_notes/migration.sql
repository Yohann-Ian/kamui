-- CreateTable
CREATE TABLE "StatusNote" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StatusNote_jobId_stage_key" ON "StatusNote"("jobId", "stage");

-- AddForeignKey
ALTER TABLE "StatusNote" ADD CONSTRAINT "StatusNote_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
