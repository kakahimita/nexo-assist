ALTER TABLE "Message" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'employee';
ALTER TABLE "Message" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'completed';
CREATE TABLE "AgentDecision" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "messageId" TEXT NOT NULL,
  "intent" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "appliedRule" TEXT NOT NULL,
  "confidence" REAL NOT NULL,
  "justification" TEXT NOT NULL,
  "missingFactsJson" TEXT NOT NULL,
  "quickRepliesJson" TEXT NOT NULL,
  "actionsJson" TEXT NOT NULL,
  "evidenceJson" TEXT NOT NULL,
  "ticketsJson" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "errorCode" TEXT,
  "source" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentDecision_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AgentDecision_messageId_key" ON "AgentDecision"("messageId");
CREATE INDEX "AgentDecision_messageId_idx" ON "AgentDecision"("messageId");
