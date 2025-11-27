-- CreateTable
CREATE TABLE "UserJourney" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserJourney_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserJourneyEntry" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserJourneyEntry_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "UserJourney" ADD CONSTRAINT "UserJourney_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserJourneyEntry" ADD CONSTRAINT "UserJourneyEntry_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "UserJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;
