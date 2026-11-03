ALTER TABLE "AgentDecision" ADD COLUMN "draftId" TEXT;
CREATE TABLE "DraftProposalRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ownerId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "draftId" TEXT NOT NULL,
  CONSTRAINT "DraftProposalRun_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DraftProposalRun_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DraftProposalRun_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "TicketDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DraftProposalRun_draftId_key" ON "DraftProposalRun"("draftId");
CREATE INDEX "DraftProposalRun_ownerId_conversationId_idx" ON "DraftProposalRun"("ownerId", "conversationId");
