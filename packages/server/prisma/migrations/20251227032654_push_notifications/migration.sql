/*
  Warnings:

  - You are about to drop the column `frequency` on the `JourneyCheckIn` table. All the data in the column will be lost.
  - You are about to drop the `JourneyCheckInNotification` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "PushNotificationStatus" AS ENUM ('OK', 'ERROR', 'RESOLVED');

-- CreateEnum
CREATE TYPE "UserPushNotificationScheduleFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- DropForeignKey
ALTER TABLE "JourneyCheckInNotification" DROP CONSTRAINT "JourneyCheckInNotification_checkInId_fkey";

-- AlterTable
ALTER TABLE "JourneyCheckIn" DROP COLUMN "frequency";

-- AlterTable
ALTER TABLE "UserPushToken" ADD COLUMN     "revoked" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "JourneyCheckInNotification";

-- DropEnum
DROP TYPE "CheckInFrequency";

-- CreateTable
CREATE TABLE "UserPushNotification" (
    "id" TEXT NOT NULL,
    "pushTokenId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "ticketId" TEXT,
    "receiptId" TEXT,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "errorDetails" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPushNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPushNotificationSchedule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "checkInId" TEXT NOT NULL,
    "frequency" "UserPushNotificationScheduleFrequency" NOT NULL,
    "minuteOfDay" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPushNotificationSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserPushNotification_pushTokenId_idx" ON "UserPushNotification"("pushTokenId");

-- CreateIndex
CREATE INDEX "UserPushNotification_scheduleId_idx" ON "UserPushNotification"("scheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPushNotificationSchedule_checkInId_key" ON "UserPushNotificationSchedule"("checkInId");

-- AddForeignKey
ALTER TABLE "UserPushNotification" ADD CONSTRAINT "UserPushNotification_pushTokenId_fkey" FOREIGN KEY ("pushTokenId") REFERENCES "UserPushToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPushNotification" ADD CONSTRAINT "UserPushNotification_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "UserPushNotificationSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPushNotificationSchedule" ADD CONSTRAINT "UserPushNotificationSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPushNotificationSchedule" ADD CONSTRAINT "UserPushNotificationSchedule_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "JourneyCheckIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
