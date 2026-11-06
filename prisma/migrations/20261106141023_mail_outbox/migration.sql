-- CreateTable
CREATE TABLE "MailOutbox" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "recipient" TEXT,
    "subject" TEXT,
    "text" TEXT,
    "html" TEXT,
    "headers" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastError" TEXT,
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MailOutbox_channel_failedAt_nextAttemptAt_idx" ON "MailOutbox"("channel", "failedAt", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "MailOutbox_failedAt_idx" ON "MailOutbox"("failedAt");

-- CreateIndex
CREATE INDEX "MailOutbox_expiresAt_idx" ON "MailOutbox"("expiresAt");
