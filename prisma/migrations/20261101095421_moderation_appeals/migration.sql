-- CreateEnum
CREATE TYPE "ModerationDecisionKind" AS ENUM ('PROJECT_HIDE', 'PROJECT_REJECT');

-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('NONE', 'OPEN', 'GRANTED', 'DENIED');

-- CreateTable
CREATE TABLE "ModerationDecision" (
    "id" TEXT NOT NULL,
    "kind" "ModerationDecisionKind" NOT NULL,
    "projectId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appealTokenHash" TEXT NOT NULL,
    "appealUntil" TIMESTAMP(3) NOT NULL,
    "appealStatus" "AppealStatus" NOT NULL DEFAULT 'NONE',
    "appealMessage" TEXT,
    "appealedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ModerationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModerationDecision_appealTokenHash_key" ON "ModerationDecision"("appealTokenHash");

-- CreateIndex
CREATE INDEX "ModerationDecision_appealStatus_appealedAt_idx" ON "ModerationDecision"("appealStatus", "appealedAt");

-- CreateIndex
CREATE INDEX "ModerationDecision_projectId_idx" ON "ModerationDecision"("projectId");

-- AddForeignKey
ALTER TABLE "ModerationDecision" ADD CONSTRAINT "ModerationDecision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationDecision" ADD CONSTRAINT "ModerationDecision_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
