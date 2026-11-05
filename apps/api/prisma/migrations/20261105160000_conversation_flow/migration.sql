ALTER TABLE "Conversation" ADD COLUMN "flowJson" TEXT NOT NULL DEFAULT '{"mode":"none","stage":"idle","facts":{}}';
