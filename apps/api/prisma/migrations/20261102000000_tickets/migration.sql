CREATE TABLE "Ticket" (
  "id" TEXT NOT NULL PRIMARY KEY, "ownerId" TEXT NOT NULL, "title" TEXT NOT NULL,
  "normalizedTitle" TEXT NOT NULL, "description" TEXT NOT NULL, "type" TEXT NOT NULL,
  "category" TEXT NOT NULL, "priority" TEXT NOT NULL, "impact" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open', "transferRequested" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "resolvedAt" DATETIME, "slaStartedAt" DATETIME NOT NULL,
  CONSTRAINT "Ticket_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Ticket_ownerId_idx" ON "Ticket"("ownerId");
CREATE UNIQUE INDEX "Ticket_owner_open_normalized_title" ON "Ticket"("ownerId", "normalizedTitle") WHERE "status" = 'open';
CREATE TABLE "TicketEvent" (
  "id" TEXT NOT NULL PRIMARY KEY, "ticketId" TEXT NOT NULL, "kind" TEXT NOT NULL,
  "content" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TicketEvent_ticketId_createdAt_idx" ON "TicketEvent"("ticketId", "createdAt");
CREATE TABLE "TicketDraft" (
  "id" TEXT NOT NULL PRIMARY KEY, "ownerId" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'pending',
  CONSTRAINT "TicketDraft_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "TicketDraft_ownerId_idx" ON "TicketDraft"("ownerId");
CREATE TABLE "TicketDraftVersion" (
  "id" TEXT NOT NULL PRIMARY KEY, "draftId" TEXT NOT NULL, "version" INTEGER NOT NULL,
  "operationId" TEXT NOT NULL, "inputJson" TEXT NOT NULL, "priority" TEXT,
  CONSTRAINT "TicketDraftVersion_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "TicketDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TicketDraftVersion_operationId_key" ON "TicketDraftVersion"("operationId");
CREATE UNIQUE INDEX "TicketDraftVersion_draftId_version_key" ON "TicketDraftVersion"("draftId", "version");
CREATE TABLE "TicketOperation" (
  "operationId" TEXT NOT NULL PRIMARY KEY, "ownerId" TEXT NOT NULL, "draftId" TEXT NOT NULL,
  "version" INTEGER NOT NULL, "fingerprint" TEXT NOT NULL, "resultJson" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketOperation_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "TicketDraft" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "TicketOperation_draftId_idx" ON "TicketOperation"("draftId");
