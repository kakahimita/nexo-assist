ALTER TABLE "Conversation" ADD COLUMN "state" TEXT NOT NULL DEFAULT 'agent';
ALTER TABLE "Conversation" ADD COLUMN "stateVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Conversation" ADD COLUMN "handoffReason" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "handoffSummary" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "handoffRequestedAt" DATETIME;
