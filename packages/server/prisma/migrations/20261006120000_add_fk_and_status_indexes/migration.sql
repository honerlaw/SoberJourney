-- CreateIndex
CREATE INDEX "JourneyCheckInEntry_checkInId_idx" ON "JourneyCheckInEntry"("checkInId");

-- CreateIndex
CREATE INDEX "Conversation_userId_idx" ON "Conversation"("userId");

-- CreateIndex
CREATE INDEX "ConversationMessage_conversationId_createdAt_idx" ON "ConversationMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "JournalEntry_userId_idx" ON "JournalEntry"("userId");

-- CreateIndex
CREATE INDEX "UserJourney_userId_idx" ON "UserJourney"("userId");

-- CreateIndex
CREATE INDEX "UserJourneyEntry_journeyId_idx" ON "UserJourneyEntry"("journeyId");

-- CreateIndex
CREATE INDEX "UserPushNotification_status_idx" ON "UserPushNotification"("status");

-- CreateIndex
CREATE INDEX "UserPushNotificationSchedule_userId_idx" ON "UserPushNotificationSchedule"("userId");

