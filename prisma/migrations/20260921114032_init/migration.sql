-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "locationBin" TEXT,
    "track" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw" JSONB,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rubric" (
    "id" TEXT NOT NULL,
    "track" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rubric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Judgment" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "rubricId" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "keyGap" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Judgment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'interested',
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "track" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Judgment_jobId_rubricId_key" ON "Judgment"("jobId", "rubricId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_jobId_key" ON "Application"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_batchId_key" ON "Batch"("batchId");

-- AddForeignKey
ALTER TABLE "Judgment" ADD CONSTRAINT "Judgment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Judgment" ADD CONSTRAINT "Judgment_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "Rubric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
