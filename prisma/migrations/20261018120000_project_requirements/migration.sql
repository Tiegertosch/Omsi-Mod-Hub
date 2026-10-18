-- CreateEnum
CREATE TYPE "RequirementPricing" AS ENUM ('FREEWARE', 'PAYWARE');

-- AlterTable
ALTER TABLE "ProjectTranslation" DROP COLUMN "requirements";

-- CreateTable
CREATE TABLE "ProjectRequirement" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "pricing" "RequirementPricing" NOT NULL DEFAULT 'FREEWARE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProjectRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectRequirement_projectId_idx" ON "ProjectRequirement"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectRequirement" ADD CONSTRAINT "ProjectRequirement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

