/*
  Warnings:

  - A unique constraint covering the columns `[userId,token]` on the table `UserPushToken` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "UserPushToken_userId_token_key" ON "UserPushToken"("userId", "token");
