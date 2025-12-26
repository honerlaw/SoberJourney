/*
  Warnings:

  - You are about to drop the `JourneyCheckInEntry` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "JourneyCheckInEntry" DROP CONSTRAINT "JourneyCheckInEntry_checkInId_fkey";

-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "checkInId" TEXT;

-- DropTable
DROP TABLE "JourneyCheckInEntry";

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "JourneyCheckIn"("id") ON DELETE SET NULL ON UPDATE CASCADE;
