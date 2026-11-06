ALTER TABLE "DraftProposalRun" ADD COLUMN "requiresAnalyst" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DraftProposalRun" ADD COLUMN "handoffCompleted" BOOLEAN NOT NULL DEFAULT false;
