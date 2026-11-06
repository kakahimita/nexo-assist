ALTER TABLE "Session" ADD COLUMN "lastSeenAt" DATETIME;
ALTER TABLE "Conversation" ADD COLUMN "resolvedByAgentMessageId" TEXT;
CREATE INDEX "Session_lastSeenAt_expiresAt_idx" ON "Session"("lastSeenAt", "expiresAt");
