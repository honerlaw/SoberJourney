/*
  Warnings:

  - A unique constraint covering the columns `[pushTokenId,scheduleId]` on the table `UserPushNotification` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "UserPushNotification_pushTokenId_scheduleId_key" ON "UserPushNotification"("pushTokenId", "scheduleId");
