/*
  Warnings:

  - You are about to drop the `JourneyCheckInJourney` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[journeyId]` on the table `JourneyCheckIn` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `journeyId` to the `JourneyCheckIn` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "JourneyCheckInJourney" DROP CONSTRAINT "JourneyCheckInJourney_checkInId_fkey";

-- DropForeignKey
ALTER TABLE "JourneyCheckInJourney" DROP CONSTRAINT "JourneyCheckInJourney_journeyId_fkey";

-- AlterTable
ALTER TABLE "JourneyCheckIn" ADD COLUMN     "journeyId" TEXT NOT NULL;

-- DropTable
DROP TABLE "JourneyCheckInJourney";

-- CreateIndex
CREATE UNIQUE INDEX "JourneyCheckIn_journeyId_key" ON "JourneyCheckIn"("journeyId");

-- AddForeignKey
ALTER TABLE "JourneyCheckIn" ADD CONSTRAINT "JourneyCheckIn_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "UserJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;
