-- CreateIndex
CREATE INDEX "UserPushNotification_pushTokenId_scheduleId_receiptId_idx" ON "UserPushNotification"("pushTokenId", "scheduleId", "receiptId");
