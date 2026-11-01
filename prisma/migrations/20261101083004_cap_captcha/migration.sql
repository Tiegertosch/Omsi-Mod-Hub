-- CreateTable
CREATE TABLE "CaptchaUse" (
    "key" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaptchaUse_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "CaptchaUse_expiresAt_idx" ON "CaptchaUse"("expiresAt");
