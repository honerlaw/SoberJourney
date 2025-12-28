-- CreateEnum
CREATE TYPE "CheckInMood" AS ENUM ('SAD', 'TIRED', 'NEUTRAL', 'GOOD', 'GREAT');

-- CreateTable
CREATE TABLE "JourneyCheckInEntry" (
    "id" TEXT NOT NULL,
    "checkInId" TEXT NOT NULL,
    "mood" "CheckInMood" NOT NULL,
    "urge" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyCheckInEntry_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "JourneyCheckInEntry" ADD CONSTRAINT "JourneyCheckInEntry_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "JourneyCheckIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
