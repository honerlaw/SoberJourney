-- CreateEnum
CREATE TYPE "CheckInFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "JourneyCheckIn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "frequency" "CheckInFrequency" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyCheckInJourney" (
    "id" TEXT NOT NULL,
    "checkInId" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyCheckInJourney_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyCheckInNotification" (
    "id" TEXT NOT NULL,
    "checkInId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyCheckInNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyCheckInEntry" (
    "id" TEXT NOT NULL,
    "checkInId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyCheckInEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JourneyCheckInJourney_checkInId_journeyId_key" ON "JourneyCheckInJourney"("checkInId", "journeyId");

-- AddForeignKey
ALTER TABLE "JourneyCheckIn" ADD CONSTRAINT "JourneyCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyCheckInJourney" ADD CONSTRAINT "JourneyCheckInJourney_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "JourneyCheckIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyCheckInJourney" ADD CONSTRAINT "JourneyCheckInJourney_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "UserJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyCheckInNotification" ADD CONSTRAINT "JourneyCheckInNotification_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "JourneyCheckIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyCheckInEntry" ADD CONSTRAINT "JourneyCheckInEntry_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "JourneyCheckIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
