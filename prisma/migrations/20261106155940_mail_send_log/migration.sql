-- CreateTable
CREATE TABLE "MailSendLog" (
    "id" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailSendLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MailSendLog_sentAt_idx" ON "MailSendLog"("sentAt");
