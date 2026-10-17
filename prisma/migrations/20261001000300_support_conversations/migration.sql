ALTER TABLE "SupportTicket" ADD COLUMN "ticketNumber" SERIAL;
ALTER TABLE "SupportTicket" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "SupportTicket" ADD COLUMN "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "SupportTicket" ADD COLUMN "assignedToId" TEXT;
CREATE UNIQUE INDEX "SupportTicket_ticketNumber_key" ON "SupportTicket"("ticketNumber");
CREATE INDEX "SupportTicket_userId_lastMessageAt_idx" ON "SupportTicket"("userId", "lastMessageAt");
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SupportMessage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ticketId" TEXT NOT NULL,
  "senderId" TEXT,
  "senderType" TEXT NOT NULL DEFAULT 'USER',
  "message" TEXT NOT NULL,
  "attachmentKey" TEXT,
  "attachmentName" TEXT,
  "attachmentMime" TEXT,
  "attachmentSize" INTEGER,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SupportMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "SupportMessage_ticketId_createdAt_idx" ON "SupportMessage"("ticketId", "createdAt");
CREATE INDEX "SupportMessage_ticketId_senderType_isRead_idx" ON "SupportMessage"("ticketId", "senderType", "isRead");

INSERT INTO "SupportMessage" ("id", "ticketId", "senderId", "senderType", "message", "isRead", "createdAt", "updatedAt")
SELECT 'legacy-' || "id", "id", "userId", 'USER', "message", true, "createdAt", "updatedAt"
FROM "SupportTicket"
WHERE "message" IS NOT NULL;
UPDATE "SupportTicket" SET "lastMessageAt" = "createdAt" WHERE "lastMessageAt" IS NULL;
