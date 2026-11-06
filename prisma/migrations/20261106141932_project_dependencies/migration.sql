-- CreateTable
CREATE TABLE "ProjectDependency" (
    "projectId" TEXT NOT NULL,
    "dependsOnId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectDependency_pkey" PRIMARY KEY ("projectId","dependsOnId")
);

-- CreateIndex
CREATE INDEX "ProjectDependency_dependsOnId_idx" ON "ProjectDependency"("dependsOnId");

-- AddForeignKey
ALTER TABLE "ProjectDependency" ADD CONSTRAINT "ProjectDependency_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDependency" ADD CONSTRAINT "ProjectDependency_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
