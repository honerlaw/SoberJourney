/*
  Warnings:

  - A unique constraint covering the columns `[pushTokenId,scheduleId,receiptId]` on the table `UserPushNotification` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "UserPushNotification_pushTokenId_scheduleId_receiptId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "UserPushNotification_pushTokenId_scheduleId_receiptId_key" ON "UserPushNotification"("pushTokenId", "scheduleId", "receiptId");
