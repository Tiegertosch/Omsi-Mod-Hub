-- AlterTable
ALTER TABLE "Project" ADD COLUMN "moderationNote" TEXT;
ALTER TABLE "Project" ADD COLUMN "submittedAt" DATETIME;

-- CreateIndex
CREATE INDEX "Project_status_submittedAt_idx" ON "Project"("status", "submittedAt");
