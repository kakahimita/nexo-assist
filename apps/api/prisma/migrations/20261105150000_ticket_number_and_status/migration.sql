-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "number" INTEGER;

-- CreateTable
CREATE TABLE "TicketNumberSequence" (
    "type" TEXT NOT NULL PRIMARY KEY,
    "value" INTEGER NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'agent',
    "stateVersion" INTEGER NOT NULL DEFAULT 0,
    "handoffReason" TEXT,
    "handoffSummary" TEXT,
    "handoffRequestedAt" DATETIME,
    "assignedAnalystId" TEXT,
    "contextTicketId" TEXT,
    "closedAt" DATETIME,
    CONSTRAINT "Conversation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Conversation_assignedAnalystId_fkey" FOREIGN KEY ("assignedAnalystId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Conversation_contextTicketId_fkey" FOREIGN KEY ("contextTicketId") REFERENCES "Ticket" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Conversation" ("assignedAnalystId", "closedAt", "createdAt", "handoffReason", "handoffRequestedAt", "handoffSummary", "id", "ownerId", "state", "stateVersion") SELECT "assignedAnalystId", "closedAt", "createdAt", "handoffReason", "handoffRequestedAt", "handoffSummary", "id", "ownerId", "state", "stateVersion" FROM "Conversation";
DROP TABLE "Conversation";
ALTER TABLE "new_Conversation" RENAME TO "Conversation";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Backfill numbers per type, then start each sequence at its current maximum
UPDATE "Ticket" SET "number" = (
    SELECT "base" + "rank" - 1 FROM (
        SELECT "id",
            CASE "type" WHEN 'INC' THEN 20000 ELSE 10000 END AS "base",
            ROW_NUMBER() OVER (PARTITION BY "type" ORDER BY "createdAt", "id") AS "rank"
        FROM "Ticket"
    ) "ranked" WHERE "ranked"."id" = "Ticket"."id"
);
INSERT INTO "TicketNumberSequence" ("type", "value") SELECT "type", MAX("number") FROM "Ticket" GROUP BY "type";

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_type_number_key" ON "Ticket"("type", "number");
