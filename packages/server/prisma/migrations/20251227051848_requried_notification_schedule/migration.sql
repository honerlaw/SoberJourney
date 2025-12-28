/*
  Warnings:

  - Made the column `scheduleId` on table `UserPushNotification` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "UserPushNotification" DROP CONSTRAINT "UserPushNotification_scheduleId_fkey";

-- AlterTable
ALTER TABLE "UserPushNotification" ALTER COLUMN "scheduleId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "UserPushNotification" ADD CONSTRAINT "UserPushNotification_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "UserPushNotificationSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
